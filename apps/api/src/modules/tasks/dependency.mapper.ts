import { TaskDependency } from '@prisma/client';
import { DependencyDto } from '@pmtool/shared-types';

export function toDependencyDto(dep: TaskDependency): DependencyDto {
  return {
    id: dep.id,
    predecessorId: dep.predecessorId,
    successorId: dep.successorId,
    type: dep.type,
    lagDays: dep.lagDays,
  };
}
