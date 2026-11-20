"""Seed a single fresh authenticated quickstart organisation and application."""
import json, os, pathlib, secrets, urllib.request
base = os.environ['AIRBORNE_URL'] + '/api/'
token = None
scope = {}
def req(route, data=None):
    headers = {'Content-Type':'application/json', **scope}
    if token: headers['Authorization'] = 'Bearer ' + token
    request = urllib.request.Request(base+route, headers=headers, data=json.dumps(data).encode() if data is not None else None)
    with urllib.request.urlopen(request, timeout=90) as response: return json.load(response)
credentials = {'email':'quickstart@example.com','name':'quickstart@example.com','first_name':'Quickstart','last_name':'Local','password':secrets.token_urlsafe(24)}
pathlib.Path('credentials.json').write_text(json.dumps(credentials, indent=2))
token = req('users/create', credentials)['user_token']['access_token']
req('organisations/create', {'name':'quickstart'})
scope['x-organisation']='quickstart'
req('organisations/applications/create', {'application':'first-app'})
scope['x-application']='first-app'
for name,kind,parent in [('app_version','standard',None),('version_cohort','cohort','app_version')]:
    req('organisations/applications/dimension/create', {'dimension':name,'dimension_type':kind,'depends_on':parent,'description':'Native compatibility'})
req('organisations/applications/dimension/version_cohort/cohort/range', {'name':'v1','lower':'1.0.0','upper':'1.0.0','priority':0})
print('Created quickstart / first-app with exact version 1.0.0 cohort v1')
