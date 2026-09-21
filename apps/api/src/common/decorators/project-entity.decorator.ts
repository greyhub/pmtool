import { SetMetadata } from '@nestjs/common';

export const PROJECT_ENTITY_KEY = 'project_entity';

export interface ProjectEntityMeta {
  /** Prisma delegate name, e.g. 'riskIssue'. It must have a `projectId` column. */
  model:
    | 'riskIssue'
    | 'projectDocument'
    | 'sprint'
    | 'stakeholder'
    | 'artifact'
    | 'task'
    | 'boardColumn';
  /** Route param holding the entity id. */
  param: string;
}

/**
 * Declares that the entity named by a route param must belong to the
 * project in the URL. Enforced by ProjectEntityGuard.
 */
export const ProjectEntity = (
  model: ProjectEntityMeta['model'],
  param: string,
) =>
  SetMetadata<string, ProjectEntityMeta>(PROJECT_ENTITY_KEY, { model, param });
