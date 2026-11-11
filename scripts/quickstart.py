#!/usr/bin/env python3
"""Authenticated, isolated local sandbox. Ctrl-C removes only this run's resources."""
import argparse, json, os, pathlib, secrets, shutil, signal, socket, subprocess, time, urllib.request

def interrupted(signum, frame):
    raise KeyboardInterrupt

for shutdown_signal in (signal.SIGTERM, signal.SIGHUP):
    signal.signal(shutdown_signal, interrupted)

ROOT = pathlib.Path(__file__).resolve().parents[1]
SERVER = ROOT / 'airborne_server'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--no-dashboard', action='store_true', help='run the API and real web sample without compiling the dashboard')
parser.add_argument('--android-emulator', action='store_true', help='use 10.0.2.2 for API-only sandbox asset URLs')
parser.add_argument('--api-port', type=int, default=None, help='fixed API port for an isolated test sandbox')
parser.add_argument('--smoke', action='store_true', help='seed, report elapsed time, then clean up')
args = parser.parse_args()
if args.android_emulator and not args.no_dashboard: parser.error('--android-emulator requires --no-dashboard')
if shutil.disk_usage(ROOT).free < 4 * 1024**3:
    raise SystemExit('Quickstart requires at least 4 GB free.')
for tool in ('docker', 'cargo', 'node', 'npm', 'curl', 'jq'):
    if not shutil.which(tool): raise SystemExit(f'Install {tool} first.')
started = time.monotonic()
os.umask(0o077)
project = 'airborne-quickstart-' + secrets.token_hex(4)
state = ROOT / '.quickstart' / project
state.mkdir(parents=True)
processes = []
created = False

def run(command, **kw):
    subprocess.run(command, check=True, **kw)

def port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]

ports = {name: port() for name in ('db', 'sp', 'kc', 's3', 'api', 'dashboard')}
if args.api_port is not None: ports['api'] = args.api_port
env = os.environ.copy()
env.update(SUPERPOSITION_VERSION='0.113.0', DB_PORT=str(ports['db']), SUPERPOSITION_PORT=str(ports['sp']), KEYCLOAK_PORT=str(ports['kc']), LOCALSTACK_PORT=str(ports['s3']), AIRBORNE_DATA_DIR=str(state / 'data'))
# Resolve the maintained compose definition, then strip all global names and host bindings.
config = json.loads(subprocess.check_output(['docker', 'compose', '-f', str(SERVER / 'docker-compose.yml'), 'config', '--format', 'json'], env=env))
from quickstart_config import isolated_compose
config = isolated_compose(config, ports)
compose_file = state / 'compose.json'
compose_file.write_text(json.dumps(config))
compose = ['docker', 'compose', '-p', project, '-f', str(compose_file)]
values = {}
for line in (SERVER / '.env.example').read_text().splitlines():
    if line and not line.startswith('#') and '=' in line:
        key, value = line.split('=', 1); values[key] = value.split(' #')[0]
issuer = f"http://localhost:{ports['kc']}/realms/hyperOTA"
values.update(SERVER_HOST='127.0.0.1', DB_HOST='127.0.0.1', DB_PORT=str(ports['db']), REDIS_URL='', PORT=str(ports['api']), PUBLIC_ENDPOINT=f"http://{'10.0.2.2' if args.android_emulator else 'localhost'}:{ports['dashboard']}", SUPERPOSITION_URL=f"http://localhost:{ports['sp']}", OIDC_ISSUER_URL=issuer, OIDC_EXTERNAL_ISSUER_URL=issuer, AUTH_ADMIN_ISSUER=issuer, AUTH_ADMIN_TOKEN_URL=issuer+'/protocol/openid-connect/token', AUTH_ADMIN_CLIENT_ID='hyperota', AWS_ENDPOINT_URL=f"http://localhost:{ports['s3']}", CLOUDFRONT_DISTRIBUTION_ID='', USE_ENCRYPTED_SECRETS='false', MIGRATIONS_TO_RUN_ON_BOOT='db,superposition', RUST_LOG='warn', RELEASE_CORS_ALLOWED_ORIGINS=f"http://localhost:{ports['dashboard']}")
import shlex
(state / '.env').write_text(''.join(f'{k}={shlex.quote(v)}\n' for k,v in values.items()))

def wait(url, timeout=240):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if shutil.disk_usage(ROOT).free < 4 * 1024**3: raise RuntimeError('Stopped: under 4 GB free')
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                if response.status == 200: return
        except Exception: pass
        if any(p.poll() is not None for p in processes): raise RuntimeError(f'Process exited; inspect {state}')
        time.sleep(1)
    raise RuntimeError(f'Timeout waiting for {url}; inspect {state}')

def spawn(command, cwd, extra, log):
    handle = open(state / log, 'w')
    child = subprocess.Popen(command, cwd=cwd, env={**env, **extra}, stdout=handle, stderr=subprocess.STDOUT, start_new_session=True)
    processes.append(child)
    return child

try:
    print(f'Isolated sandbox {project}; logs: {state}', flush=True)
    created = True
    run(compose + ['up', '-d', '--wait', '--wait-timeout', '240'])
    wait(values['SUPERPOSITION_URL'] + '/superposition/organisations?all=true')
    wait(issuer + '/.well-known/openid-configuration')
    for script in ('init-superposition.sh', 'init-keycloak.sh'):
        with open(state / (script + '.log'), 'w') as log:
            run(['bash', str(SERVER / 'scripts' / script)], cwd=state, env={**env, **values}, stdout=log, stderr=subprocess.STDOUT)
    # LocalStack CLI is inside our own container; no host AWS CLI or KMS needed.
    run(compose + ['exec', '-T', 'localstack', 'awslocal', 's3', 'mb', 's3://hyper-ota-bucket'])
    with open(state / 'build.log', 'w') as log:
        run(['cargo', 'build', '-p', 'airborne_server'], cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT)
    target = pathlib.Path(env.get('CARGO_TARGET_DIR', ROOT / 'target'))
    spawn(['bash', '-c', 'set -a; source "$1"; set +a; exec "$2"', 'quickstart', str(state / '.env'), str(target / 'debug' / 'airborne_server')], SERVER, {}, 'server.log')
    base = f"http://localhost:{ports['api']}"
    wait(base + '/api/health')
    seed_env = {**env, 'AIRBORNE_URL': base, 'QUICKSTART_SEED': '1'}
    with open(state / 'seed.log', 'w') as log:
        run(['python3', str(ROOT / 'scripts' / 'quickstart-seed.py')], cwd=state, env=seed_env, stdout=log, stderr=subprocess.STDOUT)
    if not args.no_dashboard:
        dashboard = ROOT / 'airborne_dashboard'
        if not (dashboard / 'node_modules').exists(): run(['npm', 'ci'], cwd=dashboard)
        spawn(['npm', 'run', 'dev', '--', '--hostname', '127.0.0.1', '--port', str(ports['dashboard'])], dashboard, {'BACKEND_URL': base, 'S3_URL': values['AWS_ENDPOINT_URL']+'/hyper-ota-bucket'}, 'dashboard.log')
        wait(values['PUBLIC_ENDPOINT'] + '/login')
    print(f"SANDBOX READY (not first OTA booted) in {time.monotonic()-started:.1f}s: {base if args.no_dashboard else values['PUBLIC_ENDPOINT']}", flush=True)
    print(f"Credentials: {state / 'credentials.json'} (0600). Real Keycloak auth; no auth bypass. Redis, RedisInsight and docs skipped.", flush=True)
    sample_socket = socket.socket(); sample_socket.bind(('127.0.0.1', 0)); sample_port = ports['dashboard'] if args.no_dashboard else sample_socket.getsockname()[1]; sample_socket.close()
    spawn(['python3', str(ROOT / 'scripts/sample/serve.py')], ROOT, {'AIRBORNE_URL':base, 'SAMPLE_PORT':str(sample_port), 'S3_URL':values['AWS_ENDPOINT_URL']+'/hyper-ota-bucket'}, 'sample.log')
    print(f"Sample: http://localhost:{sample_port} — v1 live, v2 ready, no synthetic failures.", flush=True)
    print(f"First OTA next command: cd {shlex.quote(str(state))} && AIRBORNE_URL={shlex.quote(base)} python3 {shlex.quote(str(ROOT / 'scripts/quickstart-seed.py'))} --publish-v2", flush=True)
    print('Then click Check for update in the sample. FIRST OTA BOOTED is measured only when v2 is visible; sandbox readiness does not include native integration or builds. Ctrl-C cleans up only this sandbox.', flush=True)

    if not args.smoke:
        while True:
            if shutil.disk_usage(ROOT).free < 4 * 1024**3: raise RuntimeError('Stopped: under 4 GB free')
            if any(p.poll() is not None for p in processes): raise RuntimeError('Sandbox process exited')
            time.sleep(1)
finally:
    for child in reversed(processes):
        try: os.killpg(child.pid, signal.SIGTERM)
        except ProcessLookupError: pass
        try: child.wait(timeout=10)
        except subprocess.TimeoutExpired:
            try: os.killpg(child.pid, signal.SIGKILL)
            except ProcessLookupError: pass
            child.wait()
    if created:
        run(compose + ['stop'])
        run(compose + ['rm', '-f', '-v'])
        # Named volumes are explicitly project-labelled; never prune shared resources.
        volumes = subprocess.check_output(['docker', 'volume', 'ls', '-q', '--filter', 'label=com.docker.compose.project='+project], text=True).split()
        if volumes: run(['docker', 'volume', 'rm', *volumes])
        networks = subprocess.check_output(['docker', 'network', 'ls', '-q', '--filter', 'label=com.docker.compose.project='+project], text=True).split()
        if networks: run(['docker', 'network', 'rm', *networks])
