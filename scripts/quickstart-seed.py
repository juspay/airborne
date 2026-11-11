"""Seed a single fresh authenticated quickstart organisation and application."""
import base64, hashlib, json, os, pathlib, secrets, urllib.request
from urllib.parse import urlencode
import sys
base = os.environ['AIRBORNE_URL'] + '/api/'
token = None
scope = {}
def req(route, data=None):
    headers = {'Content-Type':'application/json', **scope}
    if token: headers['Authorization'] = 'Bearer ' + token
    request = urllib.request.Request(base+route, headers=headers, data=json.dumps(data).encode() if data is not None else None)
    with urllib.request.urlopen(request, timeout=90) as response: return json.load(response)
if '--publish-v2' in sys.argv:
    saved = json.loads(pathlib.Path('sample-release.json').read_text())
    credentials = json.loads(pathlib.Path('credentials.json').read_text())
    token = req('users/login', {'name':credentials.get('name', credentials['email']), 'password':credentials['password']})['user_token']['access_token']
    scope = saved['scope']
    req('releases/' + saved['release_id'] + '/ramp', {'traffic_percentage':1, 'change_reason':'First sample OTA check'})
    req('releases/' + saved['release_id'] + '/conclude', {'chosen_variant':saved['variant'], 'change_reason':'First real sample OTA'})
    print('Server now serves v2. Click Check for update in the sample; boot is unconfirmed until v2 appears.')
    raise SystemExit(0)
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

sample = pathlib.Path(__file__).parent / 'sample'
packages = []
for version in ('v1', 'v2'):
    data = (sample / (version + '.js')).read_bytes()
    headers = {'Authorization':'Bearer ' + token, **scope, 'Content-Type':'application/javascript', 'x-checksum':base64.b64encode(hashlib.sha256(data).digest()).decode()}
    upload = urllib.request.Request(base + 'file/upload?' + urlencode({'file_path':'index.js','tag':version}), data=data, headers=headers)
    with urllib.request.urlopen(upload, timeout=90) as response: file = json.load(response)
    packages.append(req('packages', {'index':file['id'], 'files':[], 'tag':version}))

def release(package):
    return req('releases', {'config':{'boot_timeout':4000,'release_config_timeout':4000,'properties':{}}, 'package_id':'version:' + str(package['version']), 'package':{'important':[], 'lazy':[], 'properties':{}}, 'dimensions':{'version_cohort':'v1'}})
first = release(packages[0])
req('releases/' + first['id'] + '/ramp', {'traffic_percentage':1, 'change_reason':'Sample baseline check'})
req('releases/' + first['id'] + '/conclude', {'chosen_variant':req('releases/' + first['id'])['experiment']['experiment_variants']['experimentals'][0], 'change_reason':'Sample baseline'})
second = release(packages[1])
pathlib.Path('sample-release.json').write_text(json.dumps({'scope':scope,'release_id':second['id'],'variant':req('releases/' + second['id'])['experiment']['experiment_variants']['experimentals'][0]}))
print('Seeded real sample bundles: v1 live; v2 prepared at zero exposure. No synthetic device reports.')
