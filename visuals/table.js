import { h } from '../core/dom.js';
// data: { headers: string[], rows: any[][], highlightRows?: number[], mono?, compact?, scroll? }
export default {
  type: 'table',
  render(d) {
    const hl = new Set(d.highlightRows || []);
    const table = h('table', { class: `v-table${d.mono ? ' mono' : ''}${d.compact ? ' is-compact' : ''}` },
      h('thead', {}, h('tr', {}, d.headers.map((x) => h('th', {}, x)))),
      h('tbody', {}, d.rows.map((r, i) => h('tr', { class: hl.has(i) ? 'is-hl' : '' }, r.map((c) => h('td', {}, String(c)))))));
    const wrap = h('div', { class: `table-wrap${d.scroll ? ' is-scroll' : ''}` }, table);
    if (!d.rows.length) wrap.append(h('p', { class: 'muted small' }, 'No rows yet.'));
    // Keep the newest highlighted row in view (e.g. brute-force progress).
    queueMicrotask(() => { const row = wrap.querySelector('tr.is-hl'); if (row && wrap.scrollHeight > wrap.clientHeight) wrap.scrollTop = row.offsetTop - wrap.clientHeight / 2; });
    return wrap;
  },
};
