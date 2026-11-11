import http.server, os, pathlib, socket, subprocess, tempfile, threading, time, unittest, urllib.request
SCRIPT = pathlib.Path(__file__).parent / 'sample/serve.py'
class AssetsTest(unittest.TestCase):
 def test_api_only_sample_proxies_asset_downloads(self):
  class S3(http.server.BaseHTTPRequestHandler):
   def do_GET(self):
    if self.path not in ('/bucket/assets/index.js', '/bucket/assets/org/app/index.js/hash/tag'): self.send_error(404); return
    self.send_response(200); self.end_headers(); self.wfile.write(b'window.sample = 2;')
   def log_message(self,*args): pass
  upstream=http.server.HTTPServer(('127.0.0.1',0),S3);thread=threading.Thread(target=upstream.serve_forever,daemon=True);thread.start()
  with socket.socket() as sock: sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
  child=subprocess.Popen(['python3',str(SCRIPT)],env={**os.environ,'AIRBORNE_URL':'http://unused','SAMPLE_PORT':str(port),'S3_URL':f'http://127.0.0.1:{upstream.server_port}/bucket'},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  try:
   for _ in range(50):
    try: urllib.request.urlopen(f'http://127.0.0.1:{port}/',timeout=1);break
    except OSError: time.sleep(.05)
   for bad in ['/assets/../secret', '/assets/%2e%2e/secret']:
    with self.assertRaises(urllib.error.HTTPError) as error: urllib.request.urlopen(f'http://127.0.0.1:{port}'+bad,timeout=2)
    self.assertEqual(error.exception.code,400)
   for asset in ['index.js', 'org/app/index.js/hash/tag']:
    self.assertEqual(urllib.request.urlopen(f'http://127.0.0.1:{port}/assets/{asset}',timeout=2).read(),b'window.sample = 2;')
  finally: child.terminate();child.wait(timeout=5);upstream.shutdown();upstream.server_close()
if __name__ == '__main__': unittest.main()
