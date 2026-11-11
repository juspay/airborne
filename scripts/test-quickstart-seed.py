"""Exercise the complete seeder against a fake transport, without provisioning services."""
import base64, hashlib, io, json, os, pathlib, runpy, tempfile, unittest
from unittest.mock import patch
SCRIPT = pathlib.Path(__file__).with_name('quickstart-seed.py').resolve()
class SeedTest(unittest.TestCase):
    def test_real_bundles_and_prepared_release_without_synthetic_reports(self):
        calls = []
        def transport(request, timeout):
            calls.append(request)
            route = request.full_url.split('/api/')[1]
            if route == 'users/create': result = {'user_token':{'access_token':'secret'}}
            elif route.startswith('file/upload?'):
                assert base64.b64encode(hashlib.sha256(request.data).digest()).decode() == request.headers['X-checksum']
                result = {'id':f'index.js@version:{len([c for c in calls if "file/upload?" in c.full_url])}'}
            elif route == 'packages':
                assert json.loads(request.data)['files'] == [], 'index is separate from package files'
                result = {'version':len([c for c in calls if c.full_url.endswith('/packages')])}
            elif route == 'releases':
                number = len([c for c in calls if c.full_url.endswith('/releases')])
                result = {'id':str(number), 'experiment':{'experiment_variants':{'experimentals':['experimental_1']}}}
            elif route.startswith('releases/') and request.data is None:
                release_id = route.split('/')[1]
                result = {'experiment':{'experiment_variants':{'experimentals':[release_id + '-experimental_1']}}}
            elif '/conclude' in route:
                release_id = route.split('/')[1]
                assert json.loads(request.data)['chosen_variant'] == release_id + '-experimental_1', 'use persisted variant ID'
                assert any(c.full_url.endswith('/' + release_id + '/ramp') for c in calls), 'must ramp before conclusion'
                result = {}
            else: result = {}
            return io.BytesIO(json.dumps(result).encode())
        with tempfile.TemporaryDirectory() as tmp, patch.dict(os.environ, {'AIRBORNE_URL':'http://sandbox'}), patch('urllib.request.urlopen', transport), patch('sys.argv', [str(SCRIPT)]):
            cwd=os.getcwd()
            try:
                os.chdir(tmp); runpy.run_path(str(SCRIPT))
                saved=json.loads(pathlib.Path('sample-release.json').read_text())
                self.assertEqual(saved['release_id'], '2')
                self.assertEqual(saved['variant'], '2-experimental_1')
                self.assertTrue(any(b'v2' in (c.data or b'') for c in calls if 'file/upload?' in c.full_url))
                self.assertEqual(len([c for c in calls if '/conclude' in c.full_url]), 1)
                self.assertFalse(any('/telemetry' in c.full_url for c in calls))
                for c in calls:
                    if c.full_url.endswith('/releases'):
                        body = json.loads(c.data)
                        self.assertTrue(body['package_id'].startswith('version:'))
                        self.assertEqual(body['package'], {'important':[], 'lazy':[], 'properties':{}})
            finally: os.chdir(cwd)
    def test_publish_logs_in_again_instead_of_replaying_expired_token(self):
        calls = []
        def transport(request, timeout):
            calls.append(request)
            if request.full_url.endswith('/users/login'):
                self.assertEqual(json.loads(request.data)['name'], 'owner@example.com')
                return io.BytesIO(b'{"user_token":{"access_token":"fresh"}}')
            self.assertEqual(request.headers['Authorization'], 'Bearer fresh')
            return io.BytesIO(b'{}')
        with tempfile.TemporaryDirectory() as tmp, patch.dict(os.environ, {'AIRBORNE_URL':'http://sandbox'}), patch('urllib.request.urlopen', transport), patch('sys.argv', [str(SCRIPT), '--publish-v2']):
            cwd = os.getcwd()
            try:
                os.chdir(tmp)
                pathlib.Path('credentials.json').write_text(json.dumps({'email':'owner@example.com','password':'fixture'}))
                pathlib.Path('sample-release.json').write_text(json.dumps({'token':'expired','scope':{},'release_id':'2','variant':'v2'}))
                with self.assertRaises(SystemExit) as result: runpy.run_path(str(SCRIPT))
                self.assertEqual(result.exception.code, 0)
                self.assertTrue(calls[0].full_url.endswith('/users/login'))
            finally: os.chdir(cwd)
if __name__ == '__main__': unittest.main()
