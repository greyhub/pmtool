import { BadRequestException } from '@nestjs/common';
import {
  canContain,
  defaultChildType,
  WbsNodeType,
} from '@pmtool/shared-types';

const LABEL: Record<WbsNodeType, string> = {
  PHASE: 'Giai đoạn',
  DELIVERABLE: 'Giao phẩm',
  WORK_PACKAGE: 'Gói công việc',
  ACTIVITY: 'Hoạt động',
};

export interface ChildPlacement {
  nodeType: WbsNodeType;
  /** Set when the parent must be raised to hold children (an activity that just got its first child). */
  promoteParentTo?: WbsNodeType;
}

/**
 * Decides the node type of a task placed under `parentType` (null = root) and
 * whether the parent has to change. Unspecified means ACTIVITY. An ACTIVITY parent is promoted to a work
 * package so that adding a subtask to any old task keeps working; every other
 * violation of PHASE > DELIVERABLE > WORK_PACKAGE > ACTIVITY is rejected.
 */
export function placeChild(
  parentType: WbsNodeType | null,
  requested: WbsNodeType | undefined,
): ChildPlacement {
  if (parentType === null) return { nodeType: requested ?? 'ACTIVITY' };

  let effectiveParent = parentType;
  let promoteParentTo: WbsNodeType | undefined;
  if (parentType === 'ACTIVITY') {
    effectiveParent = 'WORK_PACKAGE';
    promoteParentTo = 'WORK_PACKAGE';
  }

  // Without an explicit choice a new task is an activity — the WBS tab always
  // sends the level it wants, so plain "add subtask" flows keep their old meaning.
  const nodeType = requested ?? 'ACTIVITY';
  if (!canContain(effectiveParent, nodeType)) {
    throw new BadRequestException(
      `${LABEL[nodeType]} không thể nằm trong ${LABEL[effectiveParent]} (thứ bậc WBS: Giai đoạn > Giao phẩm > Gói công việc > Hoạt động)`,
    );
  }
  return { nodeType, promoteParentTo };
}

/** A task changing its own type must still fit under its parent and above its children. */
export function assertRetypeFits(
  next: WbsNodeType,
  parentType: WbsNodeType | null,
  childTypes: WbsNodeType[],
): void {
  if (parentType !== null && !canContain(parentType, next)) {
    throw new BadRequestException(
      `${LABEL[next]} không thể nằm trong ${LABEL[parentType]}`,
    );
  }
  const bad = childTypes.find((c) => !canContain(next, c));
  if (bad) {
    throw new BadRequestException(
      `${LABEL[next]} không thể chứa ${LABEL[bad]} — hãy đổi cấp của các công việc con trước`,
    );
  }
}
