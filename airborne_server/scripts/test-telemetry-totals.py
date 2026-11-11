#!/usr/bin/env python3
"""Local Postgres regression: one install across two native versions counts once.
Runs the actual summary query inside a rolled-back transaction; no external send.
"""
import json, re, subprocess
from pathlib import Path
source=(Path(__file__).parents[1]/'src/telemetry.rs').read_text()
query=next(q for q in re.findall(r'sql_query\("([^"]+)"\)',source) if 'GROUPING SETS' in q)
query=query.replace('$1',"'remaining-totals-test'").replace('$2',"'test'")
seed="""BEGIN;
INSERT INTO hyperotaserver.device_reports(org_id,app_id,release_id,package_version,native_version,platform,install_id,event_id,kind,release_created,received_at)
SELECT 'remaining-totals-test','test','release','1',native,'web','00000000-0000-4000-8000-000000000001',gen_random_uuid(),kind,1,now()
FROM (VALUES ('1.0'),('2.0')) versions(native) CROSS JOIN (VALUES ('boot_started'),('boot_success')) kinds(kind);
"""
r=subprocess.check_output(['docker','exec','hyper-ota-postgres','psql','-v','ON_ERROR_STOP=1','-U','postgres','-d','hyperotaserver','-Atc',seed+query+';ROLLBACK;'],text=True)
rows=json.loads(next(line for line in r.splitlines() if line.startswith('[')))
cohorts=[r for r in rows if r['platform']]
total=next(r for r in rows if r['platform'] is None)
assert len(cohorts)==2 and sum(r['boot_success'] for r in cohorts)==2
assert total['reporting_devices']==total['boot_started']==total['boot_success']==1
assert total['unverified_reports']==4
print('PASS: native-version rows sum to 2; distinct release total is 1; transaction rolled back')
