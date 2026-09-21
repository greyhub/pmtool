'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ApiError,
  useAddProjectMember,
  useOrganizationMembers,
  useProject,
  useProjectMembers,
  useRemoveProjectMember,
  useUpdateProject,
  useUpdateProjectMemberRole,
} from '@pmtool/api-client';
import {
  Badge,
  Button,
  Card,
  FormField,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@pmtool/ui';
import { usePermissions } from './use-permissions';

const PROJECT_STATUSES = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'] as const;
const ORG_ROLES = ['OWNER', 'ADMIN', 'PM', 'MEMBER', 'VIEWER'] as const;

interface FormState {
  name: string;
  description: string;
  status: (typeof PROJECT_STATUSES)[number];
  startDate: string;
  targetEndDate: string;
}

function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

function GeneralCard({ orgSlug, projectKey }: { orgSlug: string; projectKey: string }) {
  const t = useTranslations('projects.settings.general');
  const tStatus = useTranslations('projects.status');
  const { data: project } = useProject(orgSlug, projectKey);
  const updateProject = useUpdateProject(orgSlug, projectKey);
  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    if (!project) return;
    setForm({
      name: project.name,
      description: project.description ?? '',
      status: project.status,
      startDate: toDateInputValue(project.startDate),
      targetEndDate: toDateInputValue(project.targetEndDate),
    });
  }, [project]);

  if (!form) return null;

  function field<K extends keyof FormState>(key: K) {
    return {
      value: form![key],
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
      ) => setForm((f) => (f ? { ...f, [key]: e.target.value } : f)),
    };
  }

  function handleSave() {
    if (!form) return;
    updateProject.mutate({
      name: form.name,
      description: form.description || null,
      status: form.status,
      startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
      targetEndDate: form.targetEndDate ? new Date(form.targetEndDate).toISOString() : null,
    });
  }

  return (
    <Card className="flex flex-col gap-4 p-6">
      <h2 className="text-sm font-semibold text-ink-primary">{t('title')}</h2>

      <FormField label={t('name')} htmlFor="project-name">
        <Input id="project-name" {...field('name')} />
      </FormField>

      <FormField label={t('description')} htmlFor="project-description">
        <textarea
          id="project-description"
          rows={3}
          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-primary outline-none focus-visible:ring-2 focus-visible:ring-focus"
          {...field('description')}
        />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label={t('startDate')} htmlFor="project-start">
          <Input id="project-start" type="date" {...field('startDate')} />
        </FormField>
        <FormField label={t('targetEndDate')} htmlFor="project-end">
          <Input id="project-end" type="date" {...field('targetEndDate')} />
        </FormField>
        <FormField label={t('status')} htmlFor="project-status" hint={t('archiveHint')}>
          <Select id="project-status" {...field('status')}>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {tStatus(s)}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      {updateProject.isError && (
        <p role="alert" className="text-sm text-danger">
          {updateProject.error instanceof ApiError
            ? updateProject.error.message
            : t('genericError')}
        </p>
      )}

      <div className="flex justify-end">
        <Button disabled={updateProject.isPending} onClick={handleSave}>
          {t('save')}
        </Button>
      </div>
    </Card>
  );
}

function SprintsCard({ orgSlug, projectKey }: { orgSlug: string; projectKey: string }) {
  const t = useTranslations('projects.settings.sprints');
  const { data: project } = useProject(orgSlug, projectKey);
  const updateProject = useUpdateProject(orgSlug, projectKey);
  const { canManage } = usePermissions(orgSlug, projectKey);
  if (!project) return null;

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div>
        <h2 className="text-sm font-semibold text-ink-primary">{t('title')}</h2>
        <p className="text-sm text-ink-secondary">{t('subtitle')}</p>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-primary">
        <input
          type="checkbox"
          checked={project.sprintsEnabled}
          disabled={!canManage || updateProject.isPending}
          onChange={(e) => updateProject.mutate({ sprintsEnabled: e.target.checked })}
        />
        {t('enable')}
      </label>
      {project.sprintsEnabled && (
        <FormField label={t('unit')} htmlFor="project-estimation-unit" hint={t('unitHint')}>
          <Select
            id="project-estimation-unit"
            className="w-48"
            value={project.estimationUnit}
            disabled={!canManage || updateProject.isPending}
            onChange={(e) =>
              updateProject.mutate({ estimationUnit: e.target.value as 'POINTS' | 'HOURS' })
            }
          >
            <option value="POINTS">{t('points')}</option>
            <option value="HOURS">{t('hours')}</option>
          </Select>
        </FormField>
      )}
    </Card>
  );
}

function MembersCard({ orgSlug, projectKey }: { orgSlug: string; projectKey: string }) {
  const t = useTranslations('projects.settings.members');
  const { data: orgMembers } = useOrganizationMembers(orgSlug);
  const { data: overrides } = useProjectMembers(orgSlug, projectKey);
  const addMember = useAddProjectMember(orgSlug, projectKey);
  const updateRole = useUpdateProjectMemberRole(orgSlug, projectKey);
  const removeMember = useRemoveProjectMember(orgSlug, projectKey);

  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<(typeof ORG_ROLES)[number]>('PM');

  const overriddenUserIds = new Set((overrides ?? []).map((o) => o.userId));
  const candidates = (orgMembers ?? []).filter((m) => !overriddenUserIds.has(m.userId));

  function handleAdd() {
    if (!selectedUserId) return;
    addMember.mutate(
      { userId: selectedUserId, role: selectedRole },
      { onSuccess: () => setSelectedUserId('') },
    );
  }

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div>
        <h2 className="text-sm font-semibold text-ink-primary">{t('title')}</h2>
        <p className="text-sm text-ink-secondary">{t('subtitle')}</p>
      </div>

      {candidates.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <FormField label={t('addMember')} htmlFor="project-member-user" className="flex-1">
            <Select
              id="project-member-user"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="">{t('selectMember')}</option>
              {candidates.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user?.fullName} ({m.user?.email})
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t('role')} htmlFor="project-member-role">
            <Select
              id="project-member-role"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as (typeof ORG_ROLES)[number])}
              className="w-36"
            >
              {ORG_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </FormField>
          <Button disabled={addMember.isPending || !selectedUserId} onClick={handleAdd}>
            {t('add')}
          </Button>
        </div>
      )}

      {(addMember.isError || updateRole.isError || removeMember.isError) && (
        <p role="alert" className="text-sm text-danger">
          {t('actionError')}
        </p>
      )}

      {overrides && overrides.length > 0 ? (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{t('columnName')}</TableHeaderCell>
              <TableHeaderCell>{t('columnRole')}</TableHeaderCell>
              <TableHeaderCell></TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {overrides.map((o) => (
              <TableRow key={o.id}>
                <TableCell>
                  <span className="font-medium">{o.user?.fullName}</span>
                  <span className="block text-xs text-ink-muted">{o.user?.email}</span>
                </TableCell>
                <TableCell>
                  <Select
                    value={o.role}
                    onChange={(e) =>
                      updateRole.mutate({
                        projectMemberId: o.id,
                        role: e.target.value as (typeof ORG_ROLES)[number],
                      })
                    }
                    className="w-36"
                  >
                    {ORG_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </Select>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => removeMember.mutate(o.id)}>
                      {t('remove')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-sm text-ink-secondary">{t('empty')}</p>
      )}

      <p className="text-xs text-ink-muted">{t('removeHint')}</p>
    </Card>
  );
}

export function ProjectSettings({ orgSlug, projectKey }: { orgSlug: string; projectKey: string }) {
  const t = useTranslations('projects.settings');
  const { data: project } = useProject(orgSlug, projectKey);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink-primary">{t('title')}</h1>
          <p className="text-sm text-ink-secondary">{t('subtitle')}</p>
        </div>
        {project && <Badge variant="neutral">{project.key}</Badge>}
      </div>
      <GeneralCard orgSlug={orgSlug} projectKey={projectKey} />
      <SprintsCard orgSlug={orgSlug} projectKey={projectKey} />
      <MembersCard orgSlug={orgSlug} projectKey={projectKey} />
    </div>
  );
}
