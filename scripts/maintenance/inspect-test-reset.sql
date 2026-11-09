-- Read-only aggregate inventory. Run on the selected Neon DEVELOPMENT branch first.
-- No account email, phone, token, or ciphertext is returned.
BEGIN TRANSACTION READ ONLY;
SELECT current_database() AS database_name,
       count(*)::int AS accounts,
       md5(coalesce(string_agg(id || ':' || "createdAt"::text, ',' ORDER BY id), '')) AS account_fingerprint
FROM public."User";
SELECT u.role, coalesce(e.state::text, 'LEGACY') AS account_type, count(*)::int AS accounts
FROM public."User" u LEFT JOIN public."FoundationEnrollment" e ON e."userId" = u.id
GROUP BY u.role, e.state ORDER BY u.role, e.state;
-- Account-owned provider bindings are deleted with these disposable accounts.
SELECT (SELECT count(*) FROM public."AgentDefinition") AS local_agent_definitions,
       (SELECT count(*) FROM public."AgentProviderBinding") AS local_provider_bindings,
       (SELECT count(*) FROM public."Session") AS sessions;
SELECT count(*) AS unfinished_migrations FROM public._prisma_migrations
WHERE finished_at IS NULL AND rolled_back_at IS NULL;
ROLLBACK;
