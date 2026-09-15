import { BoardColumn } from '@prisma/client';
import { BoardColumnDto } from '@pmtool/shared-types';

export function toBoardColumnDto(column: BoardColumn): BoardColumnDto {
  return {
    id: column.id,
    projectId: column.projectId,
    name: column.name,
    orderIndex: column.orderIndex,
    wipLimit: column.wipLimit,
  };
}
