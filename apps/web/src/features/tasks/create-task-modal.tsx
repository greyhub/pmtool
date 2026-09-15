'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { createTaskSchema, CreateTaskInput } from '@pmtool/shared-types';
import { useCreateTask, ApiError } from '@pmtool/api-client';
import { Button, FormField, Input, Modal } from '@pmtool/ui';

export function CreateTaskModal({
  orgSlug,
  projectKey,
  parentTaskId,
  open,
  onClose,
}: {
  orgSlug: string;
  projectKey: string;
  parentTaskId?: string;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('tasks.create');
  const createTask = useCreateTask(orgSlug, projectKey);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTaskInput>({ resolver: zodResolver(createTaskSchema) });

  const onSubmit = handleSubmit((data) => {
    createTask.mutate(
      { ...data, parentTaskId },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      },
    );
  });

  return (
    <Modal open={open} onClose={onClose} title={t('title')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField label={t('titleLabel')} htmlFor="task-title" error={errors.title?.message}>
          <Input id="task-title" autoFocus invalid={!!errors.title} {...register('title')} />
        </FormField>

        {createTask.isError && (
          <p role="alert" className="text-sm text-danger">
            {createTask.error instanceof ApiError ? createTask.error.message : 'Có lỗi xảy ra'}
          </p>
        )}

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" disabled={createTask.isPending}>
            {t('submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
