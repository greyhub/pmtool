-- Sprint review: when a task joined its sprint (to spot work added mid-sprint), and what a sprint looked like when it closed.
ALTER TABLE "tasks" ADD COLUMN "sprintAddedAt" TIMESTAMP(3);
ALTER TABLE "sprints" ADD COLUMN "reviewNotes" TEXT;
ALTER TABLE "sprints" ADD COLUMN "goalResult" TEXT;
ALTER TABLE "sprints" ADD COLUMN "outcome" JSONB;
