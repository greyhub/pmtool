-- Indexes for foreign keys that are filtered on (or cascade through) but had none: "My tasks", quests and digests
-- look assignees up by user; permission checks by project member; the Kanban board by column; and so on.
CREATE INDEX "task_assignees_userId_idx" ON "task_assignees"("userId");
CREATE INDEX "project_members_userId_idx" ON "project_members"("userId");
CREATE INDEX "task_dependencies_successorId_idx" ON "task_dependencies"("successorId");
CREATE INDEX "tasks_boardColumnId_idx" ON "tasks"("boardColumnId");
CREATE INDEX "comments_authorId_idx" ON "comments"("authorId");
CREATE INDEX "activity_logs_actorId_idx" ON "activity_logs"("actorId");
CREATE INDEX "risk_issues_ownerId_idx" ON "risk_issues"("ownerId");
CREATE INDEX "deliverables_ownerId_idx" ON "deliverables"("ownerId");
CREATE INDEX "user_badges_userId_idx" ON "user_badges"("userId");
CREATE INDEX "user_scores_userId_idx" ON "user_scores"("userId");
