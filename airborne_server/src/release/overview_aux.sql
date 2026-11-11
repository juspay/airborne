SELECT jsonb_build_object(
 'org_id',a.org_id,'app_id',a.app_id,
 'approval_required',coalesce((SELECT (data->>'enabled')::boolean FROM hyperotaserver.approval_policies p WHERE (p.org_id,p.app_id)=(a.org_id,a.app_id)),false),
 'pending_requests',(SELECT count(*) FROM hyperotaserver.deployment_requests r WHERE (r.org_id,r.app_id)=(a.org_id,a.app_id) AND status='pending'),
 'emergency_needs_review',coalesce((SELECT jsonb_agg(data || jsonb_build_object('id',id,'release_id',release_id,'actor',actor,'acknowledged_by',acknowledged_by)) FROM hyperotaserver.emergency_reviews r WHERE (r.org_id,r.app_id)=(a.org_id,a.app_id) AND acknowledged_by IS NULL),'[]'),
 'release_protections',coalesce((SELECT jsonb_agg(data || jsonb_build_object('release_id',release_id)) FROM hyperotaserver.release_protections r WHERE (r.org_id,r.app_id)=(a.org_id,a.app_id)),'[]'),
 'strict',coalesce((SELECT strict FROM hyperotaserver.serving_policies p WHERE (p.org_id,p.app_id)=(a.org_id,a.app_id)),false),
 'cache_event',(SELECT jsonb_build_object('action',action,'at',created_at,'payload',payload) FROM hyperotaserver.release_events e WHERE (e.org_id,e.app_id)=(a.org_id,a.app_id) AND action IN ('cache_invalidated','cache_invalidation_failed') AND e.created_at >= COALESCE((SELECT x.started_at FROM hyperotaserver.organisation_epochs x WHERE x.org_id=a.org_id),'-infinity') ORDER BY created_at DESC,id DESC LIMIT 1)
) AS data FROM jsonb_to_recordset($1) AS a(org_id text,app_id text)
