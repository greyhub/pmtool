export const ORG_ROLES = ['OWNER', 'ADMIN', 'PM', 'MEMBER', 'VIEWER'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const JOIN_REQUEST_STATUSES = ['PENDING', 'APPROVED', 'DECLINED'] as const;
export type JoinRequestStatus = (typeof JOIN_REQUEST_STATUSES)[number];

export const LOGIN_METHODS = ['PASSWORD', 'GOOGLE'] as const;
export type LoginMethod = (typeof LOGIN_METHODS)[number];

export const ORGANIZATION_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];

export const LOCALES = ['vi', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

// Every page-mascot demo character except `kamran` (the package author's own
// likeness — not appropriate to offer as a generic pick). Grouped the same
// way the demo site groups them: animals, people, robots.
export const MASCOT_CHARACTERS = [
  'bear',
  'bunny',
  'cat',
  'deer',
  'dino',
  'fox',
  'frog',
  'hamster',
  'hedgehog',
  'koala',
  'mouse',
  'otter',
  'owl',
  'panda',
  'penguin',
  'pug',
  'raccoon',
  'redpanda',
  'sheep',
  'sloth',
  'tiger',
  'afro',
  'astronaut',
  'bald',
  'ballerina',
  'beard',
  'builder',
  'cap',
  'chef',
  'glasses',
  'grandpa',
  'granny',
  'hijabi',
  'nurse',
  'pirate',
  'scientist',
  'sikh',
  'skater',
  'wizard',
  'clockwork',
  'crt',
  'cube',
  'drone',
  'gearbot',
  'knight',
  'lantern',
  'postbot',
  'radio',
  'rocket',
  'scout',
  'toaster',
  'tv',
] as const;
export type MascotCharacter = (typeof MASCOT_CHARACTERS)[number];

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

export const RISK_STATUSES = [
  'IDENTIFIED',
  'ANALYZING',
  'MITIGATING',
  'RESOLVED',
  'CLOSED',
] as const;
export type RiskStatus = (typeof RISK_STATUSES)[number];

export const FEEDBACK_CATEGORIES = ['BUG', 'IDEA', 'OTHER'] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_STATUSES = ['NEW', 'PLANNED', 'IN_PROGRESS', 'DONE', 'DECLINED'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const BADGE_KEYS = [
  'FIRST_TASK',
  'STREAK_7',
  'STREAK_30',
  'RISK_RESOLVER',
  'TASK_MACHINE',
  'TEAM_PLAYER',
] as const;
export type BadgeKey = (typeof BADGE_KEYS)[number];

export const DELIVERABLE_STATUSES = [
  'PLANNED',
  'IN_PROGRESS',
  'SUBMITTED',
  'ACCEPTED',
  'REJECTED',
] as const;
export type DeliverableStatus = (typeof DELIVERABLE_STATUSES)[number];

/** PMBOK role of a task in the WBS, highest level first. */
export const WBS_NODE_TYPES = ['PHASE', 'DELIVERABLE', 'WORK_PACKAGE', 'ACTIVITY'] as const;
export type WbsNodeType = (typeof WBS_NODE_TYPES)[number];

export const TASK_ASSIGNEE_ROLES = ['PRIMARY', 'SUPPORT'] as const;
export type TaskAssigneeRole = (typeof TASK_ASSIGNEE_ROLES)[number];

export const QUEST_KEYS = [
  'DAILY_DUE_TASKS',
  'WEEKLY_DUE_TASKS',
  'DAILY_PROGRESS_UPDATE',
  'DAILY_LOGIN',
] as const;
export type QuestKey = (typeof QUEST_KEYS)[number];

export const QUEST_SCOPES = ['daily', 'weekly'] as const;
export type QuestScope = (typeof QUEST_SCOPES)[number];

export const CHARTER_STATUSES = ['DRAFT', 'APPROVED'] as const;
export type CharterStatus = (typeof CHARTER_STATUSES)[number];

export const STAKEHOLDER_CATEGORIES = ['INTERNAL', 'EXTERNAL'] as const;
export type StakeholderCategory = (typeof STAKEHOLDER_CATEGORIES)[number];

export const STAKEHOLDER_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type StakeholderLevel = (typeof STAKEHOLDER_LEVELS)[number];

export const STAKEHOLDER_ENGAGEMENT_LEVELS = [
  'UNAWARE',
  'RESISTANT',
  'NEUTRAL',
  'SUPPORTIVE',
  'LEADING',
] as const;
export type StakeholderEngagementLevel = (typeof STAKEHOLDER_ENGAGEMENT_LEVELS)[number];

export const DOCUMENT_CATEGORIES = [
  'CHARTER',
  'PLAN',
  'REPORT',
  'CONTRACT',
  'MEETING_NOTES',
  'DESIGN',
  'REQUIREMENT',
  'OTHER',
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_STATUSES = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'OBSOLETE'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];
