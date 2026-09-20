import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateDeliverableInput,
  DeliverableDto,
  MilestoneDto,
  RejectDeliverableInput,
  UpdateDeliverableInput,
} from '@pmtool/shared-types';
import { apiRequest } from '../http-client';
import { scopeKeys } from './scope';

function base(orgSlug: string, projectKey: string) {
  return `/api/v1/organizations/${orgSlug}/projects/${projectKey}`;
}

export const deliverableKeys = {
  list: (orgSlug: string, projectKey: string) =>
    ['organizations', orgSlug, 'projects', projectKey, 'deliverables'] as const,
  // Nested under the tasks prefix on purpose: milestones are tasks, so any task
  // mutation (which invalidates that prefix) refreshes this list too.
  milestones: (orgSlug: string, projectKey: string) =>
    ['organizations', orgSlug, 'projects', projectKey, 'tasks', 'milestones'] as const,
};

export function useDeliverables(orgSlug: string | undefined, projectKey: string | undefined) {
  return useQuery({
    queryKey: deliverableKeys.list(orgSlug ?? '', projectKey ?? ''),
    queryFn: () => apiRequest<DeliverableDto[]>(`${base(orgSlug!, projectKey!)}/deliverables`),
    enabled: Boolean(orgSlug) && Boolean(projectKey),
  });
}

export function useMilestones(orgSlug: string | undefined, projectKey: string | undefined) {
  return useQuery({
    queryKey: deliverableKeys.milestones(orgSlug ?? '', projectKey ?? ''),
    queryFn: () => apiRequest<MilestoneDto[]>(`${base(orgSlug!, projectKey!)}/milestones`),
    enabled: Boolean(orgSlug) && Boolean(projectKey),
  });
}

/** Deliverable changes also move each milestone's accepted/total roll-up. */
function useInvalidateDeliverables(orgSlug: string | undefined, projectKey: string | undefined) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: deliverableKeys.list(orgSlug ?? '', projectKey ?? '') });
    queryClient.invalidateQueries({ queryKey: deliverableKeys.milestones(orgSlug ?? '', projectKey ?? '') });
    queryClient.invalidateQueries({ queryKey: scopeKeys.map(orgSlug ?? '', projectKey ?? '') });
  };
}

export function useCreateDeliverable(orgSlug: string | undefined, projectKey: string | undefined) {
  const invalidate = useInvalidateDeliverables(orgSlug, projectKey);
  return useMutation({
    mutationFn: (input: CreateDeliverableInput) =>
      apiRequest<DeliverableDto>(`${base(orgSlug!, projectKey!)}/deliverables`, { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export function useUpdateDeliverable(orgSlug: string | undefined, projectKey: string | undefined) {
  const invalidate = useInvalidateDeliverables(orgSlug, projectKey);
  return useMutation({
    mutationFn: ({ deliverableId, input }: { deliverableId: string; input: UpdateDeliverableInput }) =>
      apiRequest<DeliverableDto>(`${base(orgSlug!, projectKey!)}/deliverables/${deliverableId}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: invalidate,
  });
}

function useTransition(orgSlug: string | undefined, projectKey: string | undefined, action: 'submit' | 'accept') {
  const invalidate = useInvalidateDeliverables(orgSlug, projectKey);
  return useMutation({
    mutationFn: (deliverableId: string) =>
      apiRequest<DeliverableDto>(`${base(orgSlug!, projectKey!)}/deliverables/${deliverableId}/${action}`, {
        method: 'POST',
      }),
    onSuccess: invalidate,
  });
}

export function useSubmitDeliverable(orgSlug: string | undefined, projectKey: string | undefined) {
  return useTransition(orgSlug, projectKey, 'submit');
}

export function useAcceptDeliverable(orgSlug: string | undefined, projectKey: string | undefined) {
  return useTransition(orgSlug, projectKey, 'accept');
}

export function useRejectDeliverable(orgSlug: string | undefined, projectKey: string | undefined) {
  const invalidate = useInvalidateDeliverables(orgSlug, projectKey);
  return useMutation({
    mutationFn: ({ deliverableId, input }: { deliverableId: string; input: RejectDeliverableInput }) =>
      apiRequest<DeliverableDto>(`${base(orgSlug!, projectKey!)}/deliverables/${deliverableId}/reject`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: invalidate,
  });
}

export function useDeleteDeliverable(orgSlug: string | undefined, projectKey: string | undefined) {
  const invalidate = useInvalidateDeliverables(orgSlug, projectKey);
  return useMutation({
    mutationFn: (deliverableId: string) =>
      apiRequest<void>(`${base(orgSlug!, projectKey!)}/deliverables/${deliverableId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
