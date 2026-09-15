export const ORG_ROLES = ['OWNER', 'ADMIN', 'PM', 'MEMBER', 'VIEWER'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const LOCALES = ['vi', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const PROJECT_STATUSES = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const DEPENDENCY_TYPES = [
  'FINISH_TO_START',
  'START_TO_START',
  'FINISH_TO_FINISH',
  'START_TO_FINISH',
] as const;
export type DependencyType = (typeof DEPENDENCY_TYPES)[number];

export const RISK_ISSUE_TYPES = ['RISK', 'ISSUE'] as const;
export type RiskIssueType = (typeof RISK_ISSUE_TYPES)[number];

export const RISK_STATUSES = ['IDENTIFIED', 'ANALYZING', 'MITIGATING', 'RESOLVED', 'CLOSED'] as const;
export type RiskStatus = (typeof RISK_STATUSES)[number];
