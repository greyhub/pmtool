-- Product metrics for the operator. READ-ONLY (selects only) and cross-tenant, so it is
-- run from the server shell, never exposed through the app. Uses no tracking of its own:
-- everything is derived from data the product already stores.
-- "Active" = the person made at least one logged change (activity_logs); reading alone is invisible here.
\pset border 1
\pset null '-'

\echo
\echo '== 1. Totals =='
SELECT
  (SELECT count(*) FROM users)                                            AS users,
  (SELECT count(*) FROM organizations WHERE status = 'ACTIVE')            AS active_orgs,
  (SELECT count(*) FROM projects)                                         AS projects,
  (SELECT count(*) FROM tasks)                                            AS tasks,
  (SELECT count(DISTINCT "actorId") FROM activity_logs
     WHERE "createdAt" >= now() - interval '7 days')                      AS active_users_7d,
  (SELECT count(DISTINCT "actorId") FROM activity_logs
     WHERE "createdAt" >= now() - interval '30 days')                     AS active_users_30d;

\echo
\echo '== 2. Activation funnel per organization (the same steps as the in-app checklist) =='
WITH o AS (
  SELECT org.id,
    EXISTS (SELECT 1 FROM projects p WHERE p."organizationId" = org.id)                          AS has_project,
    (SELECT count(*) FROM tasks t WHERE t."organizationId" = org.id) >= 5                        AS has_5_tasks,
    ((SELECT count(*) FROM memberships m WHERE m."organizationId" = org.id) >= 2
      OR EXISTS (SELECT 1 FROM membership_invites i WHERE i."organizationId" = org.id AND i."acceptedAt" IS NULL)) AS invited,
    EXISTS (SELECT 1 FROM project_scopes s WHERE s."organizationId" = org.id)
      OR EXISTS (SELECT 1 FROM tasks t WHERE t."organizationId" = org.id AND t."nodeType" <> 'ACTIVITY') AS scoped
  FROM organizations org WHERE org.status = 'ACTIVE'
)
SELECT count(*)                                                       AS orgs,
       count(*) FILTER (WHERE has_project)                            AS created_project,
       count(*) FILTER (WHERE has_project AND has_5_tasks)            AS added_5_tasks,
       count(*) FILTER (WHERE has_project AND has_5_tasks AND invited) AS invited_teammate,
       count(*) FILTER (WHERE has_project AND has_5_tasks AND invited AND scoped) AS activated
FROM o;

\echo
\echo '== 3. Weekly signup cohorts and retention (share of each cohort active again N weeks later) =='
WITH cohort AS (
  SELECT id, date_trunc('week', "createdAt") AS week0, "createdAt" AS joined FROM users
),
act AS (
  SELECT c.week0, c.id,
    bool_or(a."createdAt" >= c.joined + interval '1 day'  AND a."createdAt" < c.joined + interval '8 days')  AS d1_7,
    bool_or(a."createdAt" >= c.joined + interval '8 days' AND a."createdAt" < c.joined + interval '15 days') AS d8_14,
    bool_or(a."createdAt" >= c.joined + interval '15 days' AND a."createdAt" < c.joined + interval '29 days') AS d15_28
  FROM cohort c LEFT JOIN activity_logs a ON a."actorId" = c.id
  GROUP BY c.week0, c.id
)
SELECT to_char(week0, 'YYYY-MM-DD') AS signup_week,
       count(*)                                                  AS signups,
       round(100.0 * count(*) FILTER (WHERE d1_7)   / count(*)) AS "active_days_1_7_%",
       round(100.0 * count(*) FILTER (WHERE d8_14)  / count(*)) AS "active_days_8_14_%",
       round(100.0 * count(*) FILTER (WHERE d15_28) / count(*)) AS "active_days_15_28_%"
FROM act GROUP BY week0 ORDER BY week0 DESC LIMIT 12;

\echo
\echo '== 4. Weekly active users (last 8 weeks) =='
SELECT to_char(date_trunc('week', "createdAt"), 'YYYY-MM-DD') AS week,
       count(DISTINCT "actorId") AS active_users,
       count(*)                  AS logged_changes
FROM activity_logs
WHERE "createdAt" >= date_trunc('week', now()) - interval '7 weeks'
GROUP BY 1 ORDER BY 1 DESC;

\echo
\echo '== 5. Which features get used (logged changes, last 30 days) =='
SELECT "entityType" AS feature, count(*) AS changes, count(DISTINCT "actorId") AS people
FROM activity_logs WHERE "createdAt" >= now() - interval '30 days'
GROUP BY 1 ORDER BY 2 DESC LIMIT 15;

\echo
\echo '== 6. Sign-up method and email verification =='
SELECT count(*) FILTER (WHERE "hasPassword")            AS password_accounts,
       count(*) FILTER (WHERE NOT "hasPassword")        AS google_only_accounts,
       count(*) FILTER (WHERE "emailVerifiedAt" IS NOT NULL) AS verified_email
FROM users;
