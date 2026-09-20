import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CommentDto,
  CreateCommentInput,
  CreateDependencyInput,
  CreateTaskInput,
  DependencyDto,
  ImportTasksCsvInput,
  ImportTasksResultDto,
  MoveTaskInput,
  TaskDto,
  TaskHistoryEntryDto,
  UpdateTaskInput,
} from '@pmtool/shared-types';
import { apiRequest, apiRequestText } from '../http-client';

function base(orgSlug: string, projectKey: string) {
  return `/api/v1/organizations/${orgSlug}/projects/${projectKey}`;
}

export const taskKeys = {
  list: (orgSlug: string, projectKey: string, parentTaskId?: string | null) =>
    ['organizations', orgSlug, 'projects', projectKey, 'tasks', parentTaskId ?? 'all'] as const,
  detail: (orgSlug: string, projectKey: string, taskId: string) =>
    ['organizations', orgSlug, 'projects', projectKey, 'tasks', 'detail', taskId] as const,
  comments: (orgSlug: string, projectKey: string, taskId: string) =>
    ['organizations', orgSlug, 'projects', projectKey, 'tasks', taskId, 'comments'] as const,
  dependencies: (orgSlug: string, projectKey: string) =>
    ['organizations', orgSlug, 'projects', projectKey, 'dependencies'] as const,
};

export function useTasks(orgSlug: string | undefined, projectKey: string | undefined) {
  return useQuery({
    queryKey: taskKeys.list(orgSlug ?? '', projectKey ?? ''),
    queryFn: () => apiRequest<TaskDto[]>(`${base(orgSlug!, projectKey!)}/tasks`),
    enabled: Boolean(orgSlug) && Boolean(projectKey),
  });
}

export function useTask(orgSlug: string | undefined, projectKey: string | undefined, taskId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.detail(orgSlug ?? '', projectKey ?? '', taskId ?? ''),
    queryFn: () => apiRequest<TaskDto>(`${base(orgSlug!, projectKey!)}/tasks/${taskId}`),
    enabled: Boolean(orgSlug) && Boolean(projectKey) && Boolean(taskId),
  });
}

/** Under the tasks prefix so any task mutation refreshes it. */
export function useTaskHistory(orgSlug: string | undefined, projectKey: string | undefined, taskId: string | undefined) {
  return useQuery({
    queryKey: ['organizations', orgSlug ?? '', 'projects', projectKey ?? '', 'tasks', 'history', taskId ?? ''] as const,
    queryFn: () => apiRequest<TaskHistoryEntryDto[]>(`${base(orgSlug!, projectKey!)}/tasks/${taskId}/history`),
    enabled: Boolean(orgSlug) && Boolean(projectKey) && Boolean(taskId),
  });
}

function invalidateProjectTasks(queryClient: ReturnType<typeof useQueryClient>, orgSlug: string, projectKey: string) {
  queryClient.invalidateQueries({ queryKey: ['organizations', orgSlug, 'projects', projectKey, 'tasks'] });
}

export function useCreateTask(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) =>
      apiRequest<TaskDto>(`${base(orgSlug!, projectKey!)}/tasks`, { method: 'POST', body: input }),
    onSuccess: () => invalidateProjectTasks(queryClient, orgSlug ?? '', projectKey ?? ''),
  });
}

export function useUpdateTask(orgSlug: string | undefined, projectKey: string | undefined, taskId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTaskInput) =>
      apiRequest<TaskDto>(`${base(orgSlug!, projectKey!)}/tasks/${taskId}`, { method: 'PATCH', body: input }),
    onSuccess: (task) => {
      queryClient.setQueryData(taskKeys.detail(orgSlug ?? '', projectKey ?? '', taskId ?? ''), task);
      invalidateProjectTasks(queryClient, orgSlug ?? '', projectKey ?? '');
    },
  });
}

/** Like useUpdateTask, but takes the taskId per-call instead of fixing it at hook creation — for lists (e.g. the Gantt) where any row can be the target. */
export function useUpdateTaskById(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: UpdateTaskInput }) =>
      apiRequest<TaskDto>(`${base(orgSlug!, projectKey!)}/tasks/${taskId}`, { method: 'PATCH', body: input }),
    onSuccess: (task) => {
      queryClient.setQueryData(taskKeys.detail(orgSlug ?? '', projectKey ?? '', task.id), task);
      invalidateProjectTasks(queryClient, orgSlug ?? '', projectKey ?? '');
    },
  });
}

/** Optimistically applies the move to the cached task list so a Kanban drag feels instant, rolling back on failure. */
export function useMoveTask(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  const listKey = taskKeys.list(orgSlug ?? '', projectKey ?? '');

  return useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: MoveTaskInput }) =>
      apiRequest<TaskDto>(`${base(orgSlug!, projectKey!)}/tasks/${taskId}/move`, { method: 'PATCH', body: input }),
    onMutate: async ({ taskId, input }) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<TaskDto[]>(listKey);
      if (previous) {
        queryClient.setQueryData<TaskDto[]>(
          listKey,
          previous.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  boardColumnId: input.boardColumnId !== undefined ? input.boardColumnId : t.boardColumnId,
                  parentTaskId: input.parentTaskId !== undefined ? input.parentTaskId : t.parentTaskId,
                  orderIndex: input.orderIndex,
                }
              : t,
          ),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(listKey, context.previous);
    },
    onSettled: () => invalidateProjectTasks(queryClient, orgSlug ?? '', projectKey ?? ''),
  });
}

export function useDeleteTask(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) =>
      apiRequest<void>(`${base(orgSlug!, projectKey!)}/tasks/${taskId}`, { method: 'DELETE' }),
    onSuccess: () => invalidateProjectTasks(queryClient, orgSlug ?? '', projectKey ?? ''),
  });
}

export function useComments(orgSlug: string | undefined, projectKey: string | undefined, taskId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.comments(orgSlug ?? '', projectKey ?? '', taskId ?? ''),
    queryFn: () => apiRequest<CommentDto[]>(`${base(orgSlug!, projectKey!)}/tasks/${taskId}/comments`),
    enabled: Boolean(orgSlug) && Boolean(projectKey) && Boolean(taskId),
  });
}

export function useCreateComment(orgSlug: string | undefined, projectKey: string | undefined, taskId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCommentInput) =>
      apiRequest<CommentDto>(`${base(orgSlug!, projectKey!)}/tasks/${taskId}/comments`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.comments(orgSlug ?? '', projectKey ?? '', taskId ?? '') });
    },
  });
}

export function useDependencies(orgSlug: string | undefined, projectKey: string | undefined) {
  return useQuery({
    queryKey: taskKeys.dependencies(orgSlug ?? '', projectKey ?? ''),
    queryFn: () => apiRequest<DependencyDto[]>(`${base(orgSlug!, projectKey!)}/dependencies`),
    enabled: Boolean(orgSlug) && Boolean(projectKey),
  });
}

export function useCreateDependency(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDependencyInput) =>
      apiRequest<DependencyDto>(`${base(orgSlug!, projectKey!)}/dependencies`, { method: 'POST', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.dependencies(orgSlug ?? '', projectKey ?? '') });
    },
  });
}

export function useDeleteDependency(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dependencyId: string) =>
      apiRequest<void>(`${base(orgSlug!, projectKey!)}/dependencies/${dependencyId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.dependencies(orgSlug ?? '', projectKey ?? '') });
    },
  });
}

export function useExportTasksCsv(orgSlug: string | undefined, projectKey: string | undefined) {
  return useMutation({
    mutationFn: () => apiRequestText(`${base(orgSlug!, projectKey!)}/task-csv/export`),
  });
}

/** Validates (`dryRun`) or performs an import of tasks from CSV text. */
export function useImportTasksCsv(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ImportTasksCsvInput) =>
      apiRequest<ImportTasksResultDto>(`${base(orgSlug!, projectKey!)}/task-csv/import`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: (result) => {
      if (result.committed) invalidateProjectTasks(queryClient, orgSlug ?? '', projectKey ?? '');
    },
  });
}
