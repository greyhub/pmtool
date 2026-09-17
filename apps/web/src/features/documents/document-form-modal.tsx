'use client';

import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { createProjectDocumentSchema } from '@pmtool/shared-types';
import type { CreateProjectDocumentInput, ProjectDocumentDto } from '@pmtool/shared-types';
import {
  ApiError,
  useCreateProjectDocument,
  useOrganizationMembers,
  useUpdateProjectDocument,
} from '@pmtool/api-client';
import { Button, FormField, Input, Modal, Select } from '@pmtool/ui';

const formSchema = createProjectDocumentSchema;
type FormInput = z.infer<typeof formSchema>;

const CATEGORIES = [
  'CHARTER',
  'PLAN',
  'REPORT',
  'CONTRACT',
  'MEETING_NOTES',
  'DESIGN',
  'REQUIREMENT',
  'OTHER',
] as const;
const STATUSES = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'OBSOLETE'] as const;

export function DocumentFormModal({
  orgSlug,
  projectKey,
  open,
  editing,
  onClose,
}: {
  orgSlug: string;
  projectKey: string;
  open: boolean;
  editing?: ProjectDocumentDto;
  onClose: () => void;
}) {
  const t = useTranslations('documents.form');
  const tCategory = useTranslations('documents.category');
  const tStatus = useTranslations('documents.status');
  const createDocument = useCreateProjectDocument(orgSlug, projectKey);
  const updateDocument = useUpdateProjectDocument(orgSlug, projectKey);
  const { data: members } = useOrganizationMembers(orgSlug);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: { category: 'OTHER', version: '1.0', status: 'DRAFT' },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      editing
        ? {
            title: editing.title,
            category: editing.category,
            version: editing.version,
            status: editing.status,
            url: editing.url,
            ownerId: editing.ownerId ?? undefined,
            description: editing.description ?? undefined,
          }
        : { category: 'OTHER', version: '1.0', status: 'DRAFT' },
    );
  }, [open, editing, reset]);

  const mutation = editing ? updateDocument : createDocument;

  const onSubmit = handleSubmit((data) => {
    const payload: CreateProjectDocumentInput = { ...data, ownerId: data.ownerId || undefined };
    if (editing) {
      updateDocument.mutate({ documentId: editing.id, input: payload }, { onSuccess: onClose });
    } else {
      createDocument.mutate(payload, {
        onSuccess: () => {
          reset();
          onClose();
        },
      });
    }
  });

  return (
    <Modal open={open} onClose={onClose} title={editing ? t('editTitle') : t('createTitle')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField label={t('title')} htmlFor="document-title" error={errors.title?.message}>
          <Input id="document-title" autoFocus invalid={!!errors.title} {...register('title')} />
        </FormField>

        <FormField label={t('url')} htmlFor="document-url" error={errors.url?.message} hint={t('urlHint')}>
          <Input id="document-url" invalid={!!errors.url} {...register('url')} />
        </FormField>

        <div className="grid grid-cols-3 gap-4">
          <FormField label={t('category')} htmlFor="document-category">
            <Select id="document-category" {...register('category')}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {tCategory(c)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t('version')} htmlFor="document-version">
            <Input id="document-version" {...register('version')} />
          </FormField>
          <FormField label={t('status')} htmlFor="document-status">
            <Select id="document-status" {...register('status')}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {tStatus(s)}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <FormField label={t('owner')} htmlFor="document-owner">
          <Select id="document-owner" defaultValue="" {...register('ownerId')}>
            <option value="">{t('ownerNone')}</option>
            {(members ?? []).map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.user?.fullName}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label={t('description')} htmlFor="document-description">
          <textarea
            id="document-description"
            rows={3}
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-primary outline-none focus-visible:ring-2 focus-visible:ring-focus"
            {...register('description')}
          />
        </FormField>

        {mutation.isError && (
          <p role="alert" className="text-sm text-danger">
            {mutation.error instanceof ApiError ? mutation.error.message : 'Có lỗi xảy ra'}
          </p>
        )}

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {t('submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
