"""Local same-origin sample host. Proxies only its fixed sandbox's public release and bundle."""
import http.server, json, os, pathlib, re, urllib.request
from urllib.parse import urlsplit
root = pathlib.Path(__file__).parent
base = os.environ['AIRBORNE_URL']
class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            if self.path.startswith('/assets/'):
                if not re.fullmatch(r'/assets/(?:[A-Za-z0-9_.@-]+/)*[A-Za-z0-9_.@-]+', self.path) or '..' in self.path:
                    self.send_error(400); return
                body = urllib.request.urlopen(os.environ['S3_URL'].rstrip('/') + self.path, timeout=10).read()
                kind = 'application/octet-stream'
            elif self.path in ('/manifest', '/bundle'):
                request = urllib.request.Request(base + '/release/quickstart/first-app?toss=0', headers={'x-dimension':'app_version=1.0.0;'})
                manifest = json.load(urllib.request.urlopen(request, timeout=10))
                body = json.dumps(manifest).encode() if self.path == '/manifest' else urllib.request.urlopen(os.environ['S3_URL'].rstrip('/') + urlsplit(manifest['package']['index']['url']).path, timeout=10).read()
                kind = 'application/json' if self.path == '/manifest' else 'application/javascript'
            elif self.path == '/': body, kind = (root / 'index.html').read_bytes(), 'text/html'
            else: self.send_error(404); return
            self.send_response(200); self.send_header('Content-Type', kind); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
        except Exception: self.send_error(502, 'Sample upstream unavailable')
http.server.ThreadingHTTPServer(('127.0.0.1', int(os.environ['SAMPLE_PORT'])), Handler).serve_forever()
