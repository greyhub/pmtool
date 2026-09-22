'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ApiError,
  useApproveJoinRequest,
  useArchiveOrganization,
  useCancelInvite,
  useCreateInvite,
  useDeclineJoinRequest,
  useDeleteOrganization,
  useExportOrganization,
  useJoinRequests,
  useMe,
  useOrganization,
  useOrganizationInvites,
  useOrganizationMembers,
  useRemoveMember,
  useUnarchiveOrganization,
  useUpdateMembershipRole,
  useUpdateOrganizationName,
} from '@pmtool/api-client';
import {
  Badge,
  Button,
  Card,
  FormField,
  Input,
  Modal,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@pmtool/ui';
import { downloadJson } from '../../lib/download-json';
import { useRouter } from '../../i18n/navigation';

const ORG_ROLES = ['OWNER', 'ADMIN', 'PM', 'MEMBER', 'VIEWER'] as const;
const INVITE_ROLES = ['ADMIN', 'PM', 'MEMBER', 'VIEWER'] as const;
type OrgRole = (typeof ORG_ROLES)[number];

function GeneralCard({ orgSlug }: { orgSlug: string }) {
  const t = useTranslations('organizations.settings.general');
  const { data: org } = useOrganization(orgSlug);
  const updateName = useUpdateOrganizationName(orgSlug);
  const archiveOrg = useArchiveOrganization(orgSlug);
  const unarchiveOrg = useUnarchiveOrganization(orgSlug);
  const [name, setName] = useState('');

  useEffect(() => {
    if (org) setName(org.name);
  }, [org]);

  if (!org) return null;
  const archived = org.status === 'ARCHIVED';

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink-primary">{t('title')}</h2>
        {archived ? (
          <Badge variant="neutral">{t('archivedBadge')}</Badge>
        ) : (
          <Badge variant="success">{t('activeBadge')}</Badge>
        )}
      </div>

      <FormField label={t('name')} htmlFor="org-name">
        <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} />
      </FormField>

      {updateName.isError && (
        <p role="alert" className="text-sm text-danger">
          {updateName.error instanceof ApiError ? updateName.error.message : t('genericError')}
        </p>
      )}

      <div className="flex justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={archiveOrg.isPending || unarchiveOrg.isPending}
          onClick={() => {
            if (archived) {
              unarchiveOrg.mutate();
              return;
            }
            if (window.confirm(t('archiveConfirm'))) {
              archiveOrg.mutate();
            }
          }}
        >
          {archived ? t('unarchive') : t('archive')}
        </Button>
        <Button
          type="button"
          disabled={updateName.isPending || name.trim().length === 0}
          onClick={() => updateName.mutate({ name: name.trim() })}
        >
          {t('save')}
        </Button>
      </div>
    </Card>
  );
}

function MembersCard({ orgSlug }: { orgSlug: string }) {
  const t = useTranslations('organizations.settings.members');
  const { data: members } = useOrganizationMembers(orgSlug);
  const updateRole = useUpdateMembershipRole(orgSlug);
  const removeMember = useRemoveMember(orgSlug);
  const { data: me } = useMe();
  // Only an Owner may grant, change or remove the Owner role (the API enforces it too).
  const isOwner = members?.find((m) => m.userId === me?.id)?.role === 'OWNER';

  return (
    <Card className="p-0">
      <div className="p-6 pb-0">
        <h2 className="text-sm font-semibold text-ink-primary">{t('title')}</h2>
      </div>
      <div className="mt-4">
        {members && members.length > 0 ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t('columnName')}</TableHeaderCell>
                <TableHeaderCell>{t('columnRole')}</TableHeaderCell>
                <TableHeaderCell></TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <span className="font-medium">{m.user?.fullName}</span>
                    <span className="block text-xs text-ink-muted">{m.user?.email}</span>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={m.role}
                      onChange={(e) =>
                        updateRole.mutate({
                          membershipId: m.id,
                          role: e.target.value as OrgRole,
                        })
                      }
                      disabled={m.role === 'OWNER' && !isOwner}
                      className="w-36"
                    >
                      {ORG_ROLES.map((r) => (
                        <option key={r} value={r} disabled={r === 'OWNER' && !isOwner}>
                          {r}
                        </option>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={m.role === 'OWNER' && !isOwner}
                        onClick={() => {
                          if (window.confirm(t('removeConfirm'))) {
                            removeMember.mutate(m.id);
                          }
                        }}
                      >
                        {t('remove')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="p-6 pt-0 text-sm text-ink-secondary">{t('empty')}</p>
        )}
      </div>
      {(updateRole.isError || removeMember.isError) && (
        <p role="alert" className="px-6 pb-4 text-sm text-danger">
          {t('actionError')}
        </p>
      )}
    </Card>
  );
}

function JoinRequestsCard({ orgSlug }: { orgSlug: string }) {
  const t = useTranslations('organizations.settings.joinRequests');
  const { data: members } = useOrganizationMembers(orgSlug);
  const { data: me } = useMe();
  const isOwnerOrAdmin =
    members?.some((m) => m.userId === me?.id && (m.role === 'OWNER' || m.role === 'ADMIN')) ??
    false;
  const { data: requests } = useJoinRequests(orgSlug, isOwnerOrAdmin);
  const approve = useApproveJoinRequest(orgSlug);
  const decline = useDeclineJoinRequest(orgSlug);
  const [roleByRequest, setRoleByRequest] = useState<Record<string, (typeof INVITE_ROLES)[number]>>(
    {},
  );

  if (!isOwnerOrAdmin || !requests || requests.length === 0) return null;

  return (
    <Card className="flex flex-col gap-4 p-6">
      <h2 className="text-sm font-semibold text-ink-primary">{t('title')}</h2>
      <ul className="flex flex-col gap-3">
        {requests.map((r) => (
          <li
            key={r.id}
            className="flex flex-col gap-2 rounded-md border border-line p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <span className="font-medium text-ink-primary">{r.user.fullName}</span>
              <span className="block text-xs text-ink-muted">{r.user.email}</span>
              {r.message && (
                <span className="mt-1 block text-sm text-ink-secondary">
                  {t('message', { message: r.message })}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Select
                aria-label={t('role')}
                value={roleByRequest[r.id] ?? 'MEMBER'}
                onChange={(e) =>
                  setRoleByRequest((prev) => ({
                    ...prev,
                    [r.id]: e.target.value as (typeof INVITE_ROLES)[number],
                  }))
                }
                className="w-32"
              >
                {INVITE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                disabled={approve.isPending}
                onClick={() =>
                  approve.mutate({ requestId: r.id, role: roleByRequest[r.id] ?? 'MEMBER' })
                }
              >
                {t('approve')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={decline.isPending}
                onClick={() => decline.mutate(r.id)}
              >
                {t('decline')}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {(approve.isError || decline.isError) && (
        <p role="alert" className="text-sm text-danger">
          {t('genericError')}
        </p>
      )}
    </Card>
  );
}

function InvitesCard({ orgSlug }: { orgSlug: string }) {
  const t = useTranslations('organizations.settings.invites');
  const { data: invites } = useOrganizationInvites(orgSlug);
  const createInvite = useCreateInvite(orgSlug);
  const cancelInvite = useCancelInvite(orgSlug);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<(typeof INVITE_ROLES)[number]>('MEMBER');
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [emailed, setEmailed] = useState(false);

  function handleInvite() {
    createInvite.mutate(
      { email: email.trim(), role },
      {
        onSuccess: (invite) => {
          setEmail('');
          const origin = typeof window !== 'undefined' ? window.location.origin : '';
          setLastLink(`${origin}/invite/accept?token=${invite.rawToken}`);
          setEmailed(Boolean(invite.emailed));
        },
      },
    );
  }

  return (
    <Card className="flex flex-col gap-4 p-6">
      <h2 className="text-sm font-semibold text-ink-primary">{t('title')}</h2>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <FormField label={t('email')} htmlFor="invite-email" className="flex-1">
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </FormField>
        <FormField label={t('role')} htmlFor="invite-role">
          <Select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as (typeof INVITE_ROLES)[number])}
            className="w-36"
          >
            {INVITE_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </FormField>
        <Button
          type="button"
          disabled={createInvite.isPending || email.trim().length === 0}
          onClick={handleInvite}
        >
          {t('send')}
        </Button>
      </div>

      {createInvite.isError && (
        <p role="alert" className="text-sm text-danger">
          {createInvite.error instanceof ApiError ? createInvite.error.message : t('genericError')}
        </p>
      )}

      {lastLink && (
        <div className="rounded-md border border-line bg-surface-subtle p-3 text-xs">
          <p className="mb-1 text-ink-secondary">
            {emailed ? t('linkHintEmailed') : t('linkHint')}
          </p>
          <code className="break-all text-ink-primary">{lastLink}</code>
        </div>
      )}

      {invites && invites.length > 0 && (
        <div className="mt-2">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
            {t('pendingTitle')}
          </p>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t('columnEmail')}</TableHeaderCell>
                <TableHeaderCell>{t('columnRole')}</TableHeaderCell>
                <TableHeaderCell>{t('columnExpires')}</TableHeaderCell>
                <TableHeaderCell></TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invites.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>{inv.email}</TableCell>
                  <TableCell>
                    <Badge variant="neutral">{inv.role}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-ink-secondary">
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={cancelInvite.isPending}
                        onClick={() => cancelInvite.mutate(inv.id)}
                      >
                        {t('cancel')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}

function DataCard({ orgSlug }: { orgSlug: string }) {
  const t = useTranslations('organizations.settings.export');
  const router = useRouter();
  const exportOrg = useExportOrganization(orgSlug);
  const deleteOrg = useDeleteOrganization(orgSlug);
  const { data: members } = useOrganizationMembers(orgSlug);
  const { data: me } = useMe();
  const isOwner = members?.find((m) => m.userId === me?.id)?.role === 'OWNER';
  const needsEmail = me?.hasPassword === false;
  const [confirming, setConfirming] = useState(false);
  const [typedSlug, setTypedSlug] = useState('');
  const [password, setPassword] = useState('');

  return (
    <Card className="flex flex-col gap-4 p-6">
      <h2 className="text-sm font-semibold text-ink-primary">{t('title')}</h2>
      <p className="text-sm text-ink-secondary">{t('hint')}</p>
      <div>
        <Button
          variant="outline"
          size="sm"
          disabled={exportOrg.isPending}
          onClick={() =>
            exportOrg.mutate(undefined, {
              onSuccess: (data) =>
                downloadJson(
                  `pmtool-${orgSlug}-${new Date().toISOString().slice(0, 10)}.json`,
                  data,
                ),
            })
          }
        >
          {t('button')}
        </Button>
      </div>
      {exportOrg.isError && (
        <p role="alert" className="text-sm text-danger">
          {exportOrg.error instanceof ApiError ? exportOrg.error.message : t('error')}
        </p>
      )}

      {isOwner && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="max-w-md text-sm text-ink-secondary">{t('deleteHint')}</p>
          <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
            {t('delete')}
          </Button>
        </div>
      )}

      <Modal
        open={confirming}
        onClose={() => {
          setConfirming(false);
          setTypedSlug('');
          setPassword('');
          deleteOrg.reset();
        }}
        title={t('confirmTitle')}
        description={t('confirmBody', { slug: orgSlug })}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              {t('cancel')}
            </Button>
            <Button
              variant="danger"
              disabled={typedSlug !== orgSlug || !password || deleteOrg.isPending}
              onClick={() =>
                deleteOrg.mutate(needsEmail ? { confirmEmail: password } : { password }, {
                  onSuccess: () => router.push('/onboarding/create-organization'),
                })
              }
            >
              {t('confirmDelete')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <FormField label={t('typeSlug', { slug: orgSlug })} htmlFor="delete-org-slug">
            <Input
              id="delete-org-slug"
              value={typedSlug}
              onChange={(e) => setTypedSlug(e.target.value)}
            />
          </FormField>
          <FormField
            label={needsEmail ? t('confirmEmail') : t('password')}
            htmlFor="delete-org-password"
          >
            <Input
              id="delete-org-password"
              type={needsEmail ? 'email' : 'password'}
              autoComplete={needsEmail ? 'email' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>
          {deleteOrg.isError && (
            <p role="alert" className="text-sm text-danger">
              {deleteOrg.error instanceof ApiError ? deleteOrg.error.message : t('error')}
            </p>
          )}
        </div>
      </Modal>
    </Card>
  );
}

export function OrgSettings({ orgSlug }: { orgSlug: string }) {
  const t = useTranslations('organizations.settings');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-ink-primary">{t('title')}</h1>
        <p className="text-sm text-ink-secondary">{t('subtitle')}</p>
      </div>
      <GeneralCard orgSlug={orgSlug} />
      <MembersCard orgSlug={orgSlug} />
      <JoinRequestsCard orgSlug={orgSlug} />
      <InvitesCard orgSlug={orgSlug} />
      <DataCard orgSlug={orgSlug} />
    </div>
  );
}
