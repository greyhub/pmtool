import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  Membership,
  Organization,
  OrgJoinRequest,
  OrgRole,
  User,
} from '@prisma/client';
import { CreateJoinRequestInput } from '@pmtool/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { MailService } from '../mail/mail.service';
import {
  joinRequestApprovedMail,
  joinRequestDeclinedMail,
  joinRequestMail,
} from '../mail/mail-templates';

const INCLUDE = {
  organization: { select: { name: true, slug: true } },
  user: {
    select: {
      id: true,
      email: true,
      fullName: true,
      avatarUrl: true,
      mascotCharacter: true,
    },
  },
  decidedBy: { select: { fullName: true } },
} as const;

type RequestWithRelations = OrgJoinRequest & {
  organization: Pick<Organization, 'name' | 'slug'>;
  user: Pick<
    User,
    'id' | 'email' | 'fullName' | 'avatarUrl' | 'mascotCharacter'
  >;
  decidedBy: Pick<User, 'fullName'> | null;
};

@Injectable()
export class JoinRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationsService: OrganizationsService,
    @Optional() private readonly mail?: MailService,
  ) {}

  /** No org-membership guard runs before this — the whole point is that the caller isn't a member yet. */
  async create(orgSlug: string, userId: string, input: CreateJoinRequestInput) {
    const organization =
      await this.organizationsService.findBySlugOrThrow(orgSlug);
    if (organization.status === 'ARCHIVED') {
      throw new ForbiddenException(
        'Tổ chức này đã được lưu trữ, không nhận yêu cầu tham gia mới',
      );
    }
    const existingMember = await this.prisma.db.membership.findUnique({
      where: {
        organizationId_userId: { organizationId: organization.id, userId },
      },
    });
    if (existingMember) {
      throw new ConflictException('Bạn đã là thành viên của tổ chức này');
    }

    const existingRequest = await this.prisma.db.orgJoinRequest.findUnique({
      where: {
        organizationId_userId: { organizationId: organization.id, userId },
      },
      include: INCLUDE,
    });
    let request: typeof existingRequest;
    if (existingRequest?.status === 'PENDING') {
      // Already asked and still waiting — return the existing request instead of spamming another notification email.
      return existingRequest;
    } else if (existingRequest) {
      // A DECLINED request re-opened by asking again.
      request = await this.prisma.db.orgJoinRequest.update({
        where: { id: existingRequest.id },
        data: {
          status: 'PENDING',
          message: input.message ?? null,
          decidedById: null,
          decidedAt: null,
        },
        include: INCLUDE,
      });
    } else {
      request = await this.prisma.db.orgJoinRequest.create({
        data: {
          organizationId: organization.id,
          userId,
          message: input.message ?? null,
        },
        include: INCLUDE,
      });
    }

    await this.notifyAdmins(organization.id, request!);
    return request!;
  }

  private async notifyAdmins(
    organizationId: string,
    request: RequestWithRelations,
  ) {
    if (!this.mail) return;
    const admins = await this.prisma.db.membership.findMany({
      where: { organizationId, role: { in: ['OWNER', 'ADMIN'] } },
      include: { user: { select: { email: true, locale: true } } },
    });
    await Promise.all(
      admins.map((admin) => {
        const locale = admin.user.locale === 'en' ? 'en' : 'vi';
        const url = this.mail!.webUrl(
          `/${locale}/${request.organization.slug}/settings`,
        );
        return this.mail!.send(
          admin.user.email,
          joinRequestMail(
            locale,
            url,
            request.user.fullName,
            request.organization.name,
            request.message,
          ),
        );
      }),
    );
  }

  async listPending(organizationId: string) {
    return this.prisma.db.orgJoinRequest.findMany({
      where: { organizationId, status: 'PENDING' },
      include: INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }

  async listMine(userId: string) {
    return this.prisma.db.orgJoinRequest.findMany({
      where: { userId },
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async approve(
    organizationId: string,
    requestId: string,
    role: OrgRole,
    deciderId: string,
  ): Promise<Membership> {
    const request = await this.getPendingOrThrow(organizationId, requestId);
    const [membership] = await this.prisma.db.$transaction([
      this.prisma.db.membership.upsert({
        where: {
          organizationId_userId: { organizationId, userId: request.userId },
        },
        create: { organizationId, userId: request.userId, role },
        update: { role },
      }),
      this.prisma.db.orgJoinRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          decidedById: deciderId,
          decidedAt: new Date(),
        },
      }),
    ]);
    await this.notifyDecision(request, true);
    return membership;
  }

  async decline(organizationId: string, requestId: string, deciderId: string) {
    const request = await this.getPendingOrThrow(organizationId, requestId);
    const updated = await this.prisma.db.orgJoinRequest.update({
      where: { id: requestId },
      data: {
        status: 'DECLINED',
        decidedById: deciderId,
        decidedAt: new Date(),
      },
      include: INCLUDE,
    });
    await this.notifyDecision(request, false);
    return updated;
  }

  private async notifyDecision(
    request: RequestWithRelations,
    approved: boolean,
  ) {
    if (!this.mail) return;
    const requester = await this.prisma.db.user.findUnique({
      where: { id: request.userId },
      select: { email: true, locale: true },
    });
    if (!requester) return;
    const locale = requester.locale === 'en' ? 'en' : 'vi';
    const url = approved
      ? this.mail.webUrl(`/${locale}/${request.organization.slug}/dashboard`)
      : this.mail.webUrl(`/${locale}/onboarding/create-organization`);
    const content = approved
      ? joinRequestApprovedMail(locale, url, request.organization.name)
      : joinRequestDeclinedMail(locale, url, request.organization.name);
    await this.mail.send(requester.email, content);
  }

  private async getPendingOrThrow(organizationId: string, requestId: string) {
    const request = await this.prisma.db.orgJoinRequest.findUnique({
      where: { id: requestId },
      include: INCLUDE,
    });
    if (!request || request.organizationId !== organizationId) {
      throw new NotFoundException('Không tìm thấy yêu cầu tham gia này');
    }
    if (request.status !== 'PENDING') {
      throw new ConflictException('Yêu cầu này đã được xử lý');
    }
    return request;
  }
}
