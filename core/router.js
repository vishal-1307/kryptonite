// Hash routes (pure; shared by the app and the tests).
//   #/                     home (all methods)
//   #/c/<group-slug>       home filtered to one sidebar group
//   #/<method>             method page, Visualizer tab
//   #/<method>/<tab>       method page, another tab (explanation | code | examples)
//   …?a=<action>           optional action (e.g. ?a=decrypt)
// Anything that does not start with "#/" (e.g. "#main" from the skip link) is an in-page anchor, not a route.
export const TABS = ['visualizer', 'explanation', 'code', 'examples'];

export function parseHash(hash, methodIds = []) {
  const raw = String(hash || '');
  if (raw !== '' && raw !== '#' && !raw.startsWith('#/')) return { view: 'anchor', anchor: raw.slice(1) };
  const [path, query = ''] = raw.replace(/^#\/?/, '').split('?');
  const parts = path.split('/').filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch { return p; } });
  const action = new URLSearchParams(query).get('a') || null;
  if (!parts.length) return { view: 'home', category: null };
  if (parts[0] === 'c') return { view: 'home', category: parts[1] || null };
  const [id, tab] = parts;
  if (!methodIds.includes(id)) return { view: 'home', category: null, notFound: id };
  return { view: 'method', id, tab: TABS.includes(tab) ? tab : 'visualizer', action };
}

export function methodHash(id, { tab = 'visualizer', action = null } = {}) {
  return `#/${id}${tab && tab !== 'visualizer' ? `/${tab}` : ''}${action ? `?a=${encodeURIComponent(action)}` : ''}`;
}
