-- $1 org, $2 app, $3 snapshot, ($4,$5) keyset position, $6 since, $7 action filter,
-- $8 actor, $9 platform, $10 limit, $11 the feed's action vocabulary.
-- Rows older than the organisation's current start (organisation_epochs) belong to a
-- previous tenant of the same name and are never returned.
-- `a.action` is the feed action: CDN failures are renamed, and an operator-confirmed
-- ambiguous write (`operation_resolved`, finding=applied) appears as the action it
-- completed. Rows with no feed action (including did_not_apply findings) are not returned.
-- `history_version`: events written before package_version was recorded carry none; the
-- version of a release never changes, so take it from another event of the same release
-- (requests, approvals and executions record it). Looked up only for the rows returned.
SELECT s.*,
       (SELECT x.payload->>'package_version' FROM hyperotaserver.release_events x
        WHERE s.release_id <> '' AND x.org_id=$1 AND x.app_id=$2 AND x.release_id=s.release_id
          AND x.payload->>'package_version' ~ '^[0-9]+$'
        ORDER BY x.created_at DESC LIMIT 1) AS history_version
FROM (
SELECT e.id, e.created_at, e.release_id, a.action, e.action AS raw_action, e.actor, e.payload,
       m.group_id::text AS group_id,
       CASE WHEN m.platform IN ('web','ios','android') THEN m.platform
            WHEN e.payload->>'platform' IN ('web','ios','android') THEN e.payload->>'platform' END AS platform
FROM hyperotaserver.release_events e
LEFT JOIN hyperotaserver.app_group_members m ON m.org_id=e.org_id AND m.app_id=e.app_id
CROSS JOIN LATERAL (SELECT CASE e.action
    WHEN 'cache_invalidation_failed' THEN 'cache_failed'
    WHEN 'operation_resolved' THEN CASE WHEN e.payload->>'finding'='applied' THEN COALESCE(
        e.payload->>'resolved_action',
        (SELECT CASE o.data->'expected'->>'status'
                WHEN 'CREATED' THEN CASE WHEN o.data->'expected'->'id' IS NULL THEN 'created' END
                WHEN 'INPROGRESS' THEN 'ramped' WHEN 'CONCLUDED' THEN 'concluded' WHEN 'DISCARDED' THEN 'discarded' END
         FROM hyperotaserver.release_operations o
         WHERE o.id=(e.payload->>'operation_id')::uuid AND o.org_id=e.org_id AND o.app_id=e.app_id)) END
    ELSE e.action END AS action) a
WHERE e.org_id=$1 AND e.app_id=$2 AND e.created_at <= $3
  AND e.created_at >= COALESCE((SELECT x.started_at FROM hyperotaserver.organisation_epochs x WHERE x.org_id=$1),'-infinity')
  AND (e.created_at,e.id) < ($4,$5) AND ($6::timestamptz IS NULL OR e.created_at >= $6)
  AND a.action = ANY($11::text[])
  AND (cardinality($7::text[])=0 OR a.action = ANY($7))
  AND ($8::text IS NULL OR e.actor=$8)
  AND ($9::text IS NULL OR COALESCE(NULLIF(m.platform,'other'), e.payload->>'platform')=$9)
ORDER BY e.created_at DESC,e.id DESC LIMIT $10
) s ORDER BY s.created_at DESC, s.id DESC
