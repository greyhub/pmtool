import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TaskDependency } from '@prisma/client';
import { CreateDependencyInput } from '@pmtool/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DependenciesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    organizationId: string,
    projectId: string,
  ): Promise<TaskDependency[]> {
    return this.prisma.db.taskDependency.findMany({
      where: { organizationId, predecessor: { projectId } },
    });
  }

  async create(
    organizationId: string,
    projectId: string,
    input: CreateDependencyInput,
  ): Promise<TaskDependency> {
    const [predecessor, successor] = await Promise.all([
      this.prisma.db.task.findUnique({ where: { id: input.predecessorId } }),
      this.prisma.db.task.findUnique({ where: { id: input.successorId } }),
    ]);
    if (
      !predecessor ||
      predecessor.organizationId !== organizationId ||
      predecessor.projectId !== projectId
    ) {
      throw new BadRequestException('Công việc tiền nhiệm không hợp lệ');
    }
    if (
      !successor ||
      successor.organizationId !== organizationId ||
      successor.projectId !== projectId
    ) {
      throw new BadRequestException('Công việc kế nhiệm không hợp lệ');
    }

    if (
      await this.canReach(
        organizationId,
        input.successorId,
        input.predecessorId,
      )
    ) {
      throw new BadRequestException(
        'Không thể thêm phụ thuộc này vì sẽ tạo vòng lặp',
      );
    }

    try {
      return await this.prisma.db.taskDependency.create({
        data: {
          organizationId,
          predecessorId: input.predecessorId,
          successorId: input.successorId,
          type: input.type,
          lagDays: input.lagDays,
        },
      });
    } catch (e) {
      // Unique (predecessor, successor) pair already exists.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Phụ thuộc này đã tồn tại');
      }
      throw e;
    }
  }

  async remove(organizationId: string, dependencyId: string): Promise<void> {
    const dep = await this.prisma.db.taskDependency.findUnique({
      where: { id: dependencyId },
    });
    if (!dep || dep.organizationId !== organizationId) {
      throw new NotFoundException('Không tìm thấy phụ thuộc');
    }
    await this.prisma.db.taskDependency.delete({ where: { id: dependencyId } });
  }

  /** BFS over existing predecessor->successor edges: can we get from `fromTaskId` to `toTaskId`? Used to reject an edge that would close a cycle. */
  private async canReach(
    organizationId: string,
    fromTaskId: string,
    toTaskId: string,
  ): Promise<boolean> {
    const queue = [fromTaskId];
    const visited = new Set<string>();
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === toTaskId) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      const outgoing = await this.prisma.db.taskDependency.findMany({
        where: { organizationId, predecessorId: current },
        select: { successorId: true },
      });
      queue.push(...outgoing.map((o) => o.successorId));
    }
    return false;
  }
}
