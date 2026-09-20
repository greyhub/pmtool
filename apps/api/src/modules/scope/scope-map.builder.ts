import {
  CoverageCheck,
  DeliverableStatus,
  ScopeMapDto,
  ScopeMapEdge,
  ScopeMapNode,
} from '@pmtool/shared-types';
import { computeWbsCodes } from '@pmtool/shared-types';

export interface MapTask {
  id: string;
  title: string;
  parentTaskId: string | null;
  nodeType: 'PHASE' | 'DELIVERABLE' | 'WORK_PACKAGE' | 'ACTIVITY';
  isMilestone: boolean;
  status: string;
  percentComplete: number;
  orderIndex: number;
}

export interface MapDeliverable {
  id: string;
  name: string;
  taskId: string | null;
  status: DeliverableStatus;
  acceptanceCriteria: string | null;
}

export interface MapDictionary {
  taskId: string;
  hasContent: boolean;
  hasAcceptanceCriteria: boolean;
}

export interface ScopeMapInput {
  tasks: MapTask[];
  deliverables: MapDeliverable[];
  dictionary: MapDictionary[];
  dependencies: { predecessorId: string; successorId: string }[];
  charterStatus: 'DRAFT' | 'APPROVED' | null;
  scopeStatus: 'DRAFT' | 'APPROVED' | null;
}

/** Assembles the PMBOK linkage graph and its coverage checks from raw project data. */
export function buildScopeMap(input: ScopeMapInput): ScopeMapDto {
  const { tasks, deliverables } = input;
  const codes = computeWbsCodes(tasks);
  const taskIds = new Set(tasks.map((t) => t.id));
  const dictByTask = new Map(input.dictionary.map((d) => [d.taskId, d]));
  const childrenOf = new Map<string, MapTask[]>();
  for (const t of tasks) {
    if (t.parentTaskId && taskIds.has(t.parentTaskId)) {
      const list = childrenOf.get(t.parentTaskId) ?? [];
      list.push(t);
      childrenOf.set(t.parentTaskId, list);
    }
  }
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const recordsByTask = new Map<string, MapDeliverable[]>();
  for (const d of deliverables) {
    if (!d.taskId) continue;
    const list = recordsByTask.get(d.taskId) ?? [];
    list.push(d);
    recordsByTask.set(d.taskId, list);
  }

  const nodes: ScopeMapNode[] = [
    {
      id: 'charter',
      kind: 'charter',
      label: 'charter',
      code: null,
      taskId: null,
      status: input.charterStatus,
      progress: null,
      hasDictionary: false,
    },
    {
      id: 'scope',
      kind: 'scope',
      label: 'scope',
      code: null,
      taskId: null,
      status: input.scopeStatus,
      progress: null,
      hasDictionary: false,
    },
  ];
  const edges: ScopeMapEdge[] = [
    { from: 'charter', to: 'scope', kind: 'produces' },
  ];

  for (const t of tasks) {
    nodes.push({
      id: t.id,
      kind: t.isMilestone ? 'milestone' : t.nodeType,
      label: t.title,
      code: codes.get(t.id) ?? null,
      taskId: t.id,
      status: t.status,
      progress: t.percentComplete,
      hasDictionary: dictByTask.get(t.id)?.hasContent ?? false,
    });
    const parentInList = t.parentTaskId !== null && taskIds.has(t.parentTaskId);
    edges.push({
      from: parentInList ? (t.parentTaskId as string) : 'scope',
      to: t.id,
      kind: 'contains',
    });
  }

  for (const d of deliverables) {
    const id = `d:${d.id}`;
    nodes.push({
      id,
      kind: 'deliverableRecord',
      label: d.name,
      code: null,
      taskId: null,
      status: d.status,
      progress: null,
      hasDictionary: false,
    });
    edges.push({
      from: d.taskId && taskIds.has(d.taskId) ? d.taskId : 'scope',
      to: id,
      kind: 'produces',
    });
  }

  for (const dep of input.dependencies) {
    if (taskIds.has(dep.predecessorId) && taskIds.has(dep.successorId)) {
      edges.push({
        from: dep.predecessorId,
        to: dep.successorId,
        kind: 'depends',
      });
    }
  }

  const ofType = (type: MapTask['nodeType']) =>
    tasks.filter((t) => t.nodeType === type && !t.isMilestone);
  const check = (
    key: CoverageCheck['key'],
    pool: MapTask[],
    fails: (t: MapTask) => boolean,
  ): CoverageCheck => ({
    key,
    total: pool.length,
    offenders: pool.filter(fails).map((t) => t.id),
  });

  const workPackages = ofType('WORK_PACKAGE');
  const deliverableNodes = ofType('DELIVERABLE');
  const activities = ofType('ACTIVITY');
  const milestones = tasks.filter((t) => t.isMilestone);
  const parents = tasks.filter((t) => (childrenOf.get(t.id) ?? []).length > 0);

  const checks: CoverageCheck[] = [
    check(
      'workPackageWithoutActivity',
      workPackages,
      (t) =>
        !(childrenOf.get(t.id) ?? []).some(
          (c) => c.nodeType === 'ACTIVITY' && !c.isMilestone,
        ),
    ),
    check(
      'workPackageWithoutDictionary',
      workPackages,
      (t) => !(dictByTask.get(t.id)?.hasContent ?? false),
    ),
    check('deliverableWithoutCriteria', deliverableNodes, (t) => {
      const fromDictionary =
        dictByTask.get(t.id)?.hasAcceptanceCriteria ?? false;
      const fromRecord = (recordsByTask.get(t.id) ?? []).some(
        (r) => (r.acceptanceCriteria ?? '').trim() !== '',
      );
      return !fromDictionary && !fromRecord;
    }),
    check(
      'deliverableWithoutRecord',
      deliverableNodes,
      (t) => (recordsByTask.get(t.id) ?? []).length === 0,
    ),
    check('activityOutsideWorkPackage', activities, (t) => {
      const parent = t.parentTaskId ? byId.get(t.parentTaskId) : undefined;
      return !parent || parent.nodeType !== 'WORK_PACKAGE';
    }),
    check(
      'milestoneWithoutDeliverable',
      milestones,
      (t) => (recordsByTask.get(t.id) ?? []).length === 0,
    ),
    check(
      'singleChildParent',
      parents,
      (t) => (childrenOf.get(t.id) ?? []).length === 1,
    ),
  ];

  const deliverableStatuses = {
    PLANNED: 0,
    IN_PROGRESS: 0,
    SUBMITTED: 0,
    ACCEPTED: 0,
    REJECTED: 0,
  } as Record<DeliverableStatus, number>;
  for (const d of deliverables) deliverableStatuses[d.status] += 1;

  return {
    nodes,
    edges,
    checks,
    scopeStatus: input.scopeStatus,
    charterStatus: input.charterStatus,
    deliverableStatuses,
  };
}
