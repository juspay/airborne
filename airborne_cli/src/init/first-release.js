/** Prepare a targeted release without hand-written JSON. Never ramps or concludes it. */
export async function firstRelease({ endpoint, organisation, application, packageVersion, appVersion, token }, transport = fetch) {
  const base = new URL(endpoint);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new Error('Invalid endpoint');
  const request = async (route, body, exists = false) => {
    const res = await transport(`${endpoint.replace(/\/$/, '')}/api/${route}`, {
      method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-organisation': organisation, 'x-application': application }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (exists && res.status === 409) return;
    if (!res.ok) throw new Error(`${route}: HTTP ${res.status} ${await res.text()}`);
    return res.json();
  };
  if (!/^\d+$/.test(String(packageVersion)) || !appVersion?.trim()) throw new Error('Package version and exact native app version are required');
  const dimensions = await request('organisations/applications/dimension/list?count=100');
  const existing = dimensions.data.find(d => d.dimension === 'app_version');
  if (existing && existing.dimension_type !== 'standard') throw new Error('Existing app_version must be a standard dimension');
  if (!existing) await request('organisations/applications/dimension/create', { dimension: 'app_version', dimension_type: 'standard', depends_on: null, description: 'Declared native compatibility' }, true);
  return request('releases', { config: { boot_timeout: 4000, release_config_timeout: 4000, properties: {} }, package_id: `version:${packageVersion}`, package: { important: [], lazy: [], properties: {} }, dimensions: { app_version: appVersion } });
}
