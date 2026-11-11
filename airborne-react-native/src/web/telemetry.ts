// Copyright 2026 Juspay Technologies. Apache-2.0.
import type { AirborneWebOptions, ReleaseConfig } from './types';
// Host and OTA bundles contain independent module instances. Keep configuration
// and the in-flight gate on the page so all copies acknowledge the same boot.
const shared = globalThis as typeof globalThis & {
  __airborneTelemetry?: { active: Map<string, AirborneWebOptions>; flushing: Set<string> };
};
const { active, flushing } = shared.__airborneTelemetry ??=
  { active: new Map<string, AirborneWebOptions>(), flushing: new Set<string>() };
const key = (ns: string) => `airborne:${ns}:telemetry`;
type Entry = { receipt: string; expires: number; endpoint: string; event: { id: string; kind: string } };
type State = { install: string; queue: Entry[]; pending?: ReleaseConfig };
function read(ns: string): State {
  try { const s = JSON.parse(localStorage.getItem(key(ns)) ?? 'null'); if (s?.install) return s; } catch {}
  return { install: crypto.randomUUID(), queue: [] };
}
function write(ns: string, state: State) { localStorage.setItem(key(ns), JSON.stringify(state)); }
export async function flush(ns: string) {
  if (flushing.has(ns)) return;
  flushing.add(ns);
  try {
    const s = read(ns); s.queue = s.queue.filter(e => e.expires > Date.now() / 1000); write(ns, s);
    const first = s.queue[0]; if (!first) return;
    const batch = s.queue.filter(e => e.receipt === first.receipt).slice(0, 32);
    const response = await fetch(first.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ receipt: first.receipt, install_id: s.install, events: batch.map(e => e.event) }), signal: AbortSignal.timeout(5000) });
    if (response.ok || response.status === 400) { const latest = read(ns); const ids = new Set(batch.map(e => e.event.id)); latest.queue = latest.queue.filter(e => !ids.has(e.event.id)); write(ns, latest); if (latest.queue.length) setTimeout(() => { void flush(ns); }, 100); }
  } catch { /* Offline: bounded queue persists for the next event/launch/online. */ }
  finally { flushing.delete(ns); }
}
export function configureTelemetry(options: AirborneWebOptions) {
  if (!options.telemetryEnabled) { active.delete(options.namespace); return; }
  active.set(options.namespace, options);
  try { const s = read(options.namespace); if (s.pending) event(options.namespace, s.pending, 'boot_failed'); s.pending = undefined; const latest = read(options.namespace); latest.pending = undefined; write(options.namespace, latest); } catch {}
  window.addEventListener('online', () => { void flush(options.namespace); });
  void flush(options.namespace);
}
export function event(ns: string, rc: ReleaseConfig, kind: string) {
  const options = active.get(ns); const meta = rc.telemetry;
  if (!options || !meta) return;
  try {
    const s = read(ns);
    s.queue.push({ receipt: meta.receipt, expires: meta.expires_at, endpoint: new URL(meta.ingest_path, options.releaseConfigUrl).toString(), event: { id: crypto.randomUUID(), kind } });
    s.queue = s.queue.slice(-128);
    if (kind === 'boot_started') s.pending = rc;
    if (kind === 'boot_success' || kind === 'boot_failed') s.pending = undefined;
    write(ns, s);
    setTimeout(() => { void flush(ns); }, 100);
  } catch { /* Telemetry must not prevent a boot. */ }
}
