import { h } from '../core/dom.js';
import { animate, stagger, pop, DUR, EASE } from './anim.js';
// AES-style 4×4 state(s), column-major. data: { items: [ {label, bytes:number[16], hl?:number[], tone?:'key'|'out'} | {op} ], rowShift?: 'left'|'right' }
//
// Operation-specific animations. The operation is read from the step title ("Round 1 · SubBytes"); every number
// shown comes from the step data (before / key / after bytes) — nothing is recomputed here.
//   SubBytes / InvSubBytes : bytes are looked up one by one; a readout shows row (high hex digit), column (low
//                            hex digit) and the table value taken from the After state.
//   ShiftRows / InvShiftRows: row r of the After state slides in from r places to the right (left for Inv), with
//                            the wrapped bytes re-entering from the edge.
//   MixColumns / InvMixColumns: one column at a time pulses in Before and is replaced in After.
//   AddRoundKey            : the round-key grid slides over the state, then each output byte appears while the
//                            readout shows state ⊕ key = result in hex and binary.
// Click (or hover) any byte to pin the readout to it.
const hex = (b) => b.toString(16).padStart(2, '0');
const bin = (b) => b.toString(2).padStart(8, '0');
const OPS = ['InvSubBytes', 'SubBytes', 'InvShiftRows', 'ShiftRows', 'InvMixColumns', 'MixColumns', 'AddRoundKey'];
export const opOf = (step) => { const t = (step && step.title) || ''; return OPS.find((o) => new RegExp(`(^|[^A-Za-z])${o}\\s*$`).test(t)) || null; };
const COLMAJOR = [...Array(16).keys()]; // state index i = r + 4c, i.e. already column-major

function readoutLine(op, i, before, after, key) {
  const b = before[i], a = after[i];
  if (op === 'AddRoundKey') {
    return h('div', { class: 'ro-line', 'data-i': i },
      h('span', { class: 'ro-title' }, `byte ${i} (row ${i % 4}, col ${i >> 2})`),
      h('code', { class: 'ro-main' }, h('span', { class: 'ro-b' }, hex(b)), ' ⊕ ', h('span', { class: 'ro-k' }, hex(key[i])), ' = ', h('b', {}, hex(a))),
      h('code', { class: 'ro-bin' }, `${bin(b)} ⊕ ${bin(key[i])} = ${bin(a)}`));
  }
  const name = op === 'InvSubBytes' ? 'inverse S-box' : 'S-box';
  return h('div', { class: 'ro-line', 'data-i': i },
    h('span', { class: 'ro-title' }, `byte ${i} (row ${i % 4}, col ${i >> 2})`),
    h('code', { class: 'ro-main' }, hex(b), ' → ', name, '[', h('span', { class: 'ro-row' }, `row ${hex(b)[0]}`), ', ', h('span', { class: 'ro-col' }, `col ${hex(b)[1]}`), '] = ', h('b', {}, hex(a))));
}

export default {
  type: 'byteGrid',
  render(d, step) {
    const op = opOf(step);
    const grids = d.items.filter((it) => it.op === undefined);
    const first = grids[0];
    const outItem = [...grids].reverse().find((it) => it.tone === 'out');
    const keyItem = grids.find((it) => it.tone === 'key');
    const refs = new Map(); // item → cells[i]
    const lookup = op === 'SubBytes' || op === 'InvSubBytes';
    const grid = (it) => {
      const hl = new Set(it.hl || []);
      const cells = new Array(16);
      const nodes = [];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        const i = r + 4 * c;
        const v = hex(it.bytes[i]);
        // In a lookup, the Before byte's two hex digits are the S-box row and column.
        const content = lookup && it === first ? h('span', { class: 'nibs' }, h('span', { class: 'nib-row' }, v[0]), h('span', { class: 'nib-col' }, v[1])) : v;
        const cell = h('span', { class: `cell${hl.has(i) && !op ? ' is-hl' : ''}`, title: `row ${r}, col ${c}`, 'data-i': i, role: 'gridcell',
          tabindex: i === 0 ? '0' : '-1', 'aria-label': `${it.label}: byte ${i}, row ${r}, column ${c}, value ${v}${hl.has(i) ? ', highlighted' : ''}` }, content);
        cells[i] = cell; nodes.push(cell);
      }
      refs.set(it, cells);
      // Keyboard: one tab stop per state grid; arrow keys / Home / End move between bytes (roving tabindex).
      const rows = [0, 1, 2, 3].map((r) => h('div', { role: 'row', class: 'bg-row' }, nodes.slice(r * 4, r * 4 + 4)));
      return h('figure', { class: `bg-state${it.tone ? ` tone-${it.tone}` : ''}` },
        h('div', { class: 'bg-grid', role: 'grid', 'aria-label': `${it.label} (4×4 bytes; arrow keys move between bytes)` }, rows), h('figcaption', {}, it.label));
    };
    const shifts = d.rowShift ? h('div', { class: 'bg-shifts' }, [0, 1, 2, 3].map((r) => h('span', {}, r === 0 ? '—' : `${d.rowShift === 'left' ? '←' : '→'} ${r}`))) : null;
    const row = h('div', { class: 'v-bytegrid' }, shifts, d.items.map((it) => (it.op !== undefined ? h('span', { class: 'mx-op' }, it.op) : grid(it))));
    const said = h('p', { class: 'sr-only', 'aria-live': 'polite', 'aria-atomic': 'true' });
    const el = h('div', { class: `bg-wrap${op ? ` op-${op}` : ''}` }, row, said);

    // Readout (lookup / XOR) — one line per byte stacked in the same grid cell; only the pinned one is visible at rest.
    let lines = null, pin = () => {}, showPin = () => {}, current = 0;
    if (op && (lookup || op === 'AddRoundKey') && first && outItem) {
      lines = COLMAJOR.map((i) => readoutLine(op, i, first.bytes, outItem.bytes, keyItem ? keyItem.bytes : []));
      const box = h('div', { class: 'bg-readout', 'aria-live': 'off' }, lines);
      el.append(box, h('p', { class: 'bg-tip muted small' }, 'Tip: click a byte to see its ' + (lookup ? 'S-box lookup.' : 'XOR.')));
      // showPin(-1) hides the resting focus/readout (used while the sweep runs); pin(i) also remembers the choice.
      showPin = (i) => {
        lines.forEach((l, k) => l.classList.toggle('is-pinned', k === i));
        for (const cells of refs.values()) cells.forEach((c, k) => c.classList.toggle('is-focus', k === i));
      };
      pin = (i) => { current = i; showPin(i); };
      pin(0);
      row.addEventListener('click', (e) => { const c = e.target.closest('.cell[data-i]'); if (c) pin(Number(c.dataset.i)); });
      row.addEventListener('mouseover', (e) => { const c = e.target.closest('.cell[data-i]'); if (c) pin(Number(c.dataset.i)); });
    }
    // Visible detail for steps without a lookup/XOR readout (ShiftRows, MixColumns, key schedule…): shown when a
    // byte is focused, clicked or Enter is pressed, so keyboard inspection is visible, not only announced.
    let detail = null;
    const itemOf = (c) => [...refs.entries()].find(([, cs]) => cs.includes(c));
    const detailText = (c) => {
      const found = itemOf(c); if (!found) return '';
      const [it] = found; const i = Number(c.dataset.i), r = i % 4, col = i >> 2;
      const base = `${it.label}: byte ${i} (row ${r}, col ${col}) = ${hex(it.bytes[i])}`;
      if (first && outItem && it === outItem && (op === 'ShiftRows' || op === 'InvShiftRows')) {
        const fc = op === 'ShiftRows' ? (col + r) % 4 : (col - r + 4) % 4;
        return r === 0 ? `${base}. Row 0 does not move.` : `${base}, moved from ${first.label} row ${r}, col ${fc} (shift ${op === 'ShiftRows' ? 'left' : 'right'} by ${r}).`;
      }
      if (first && outItem && it === outItem && (op === 'MixColumns' || op === 'InvMixColumns')) {
        return `${base}, mixed from ${first.label} column ${col}: ${[0, 1, 2, 3].map((k) => hex(first.bytes[k + 4 * col])).join(' ')}.`;
      }
      if (first && outItem && it === first && (op === 'ShiftRows' || op === 'InvShiftRows')) {
        const tc = op === 'ShiftRows' ? (col - r + 4) % 4 : (col + r) % 4;
        return r === 0 ? `${base}. Row 0 does not move.` : `${base}, goes to ${outItem.label} row ${r}, col ${tc}.`;
      }
      if (first && outItem && it === first && (op === 'MixColumns' || op === 'InvMixColumns')) return `${base}, feeds ${outItem.label} column ${col}.`;
      return `${base}.`;
    };
    if (!lines) {
      detail = h('p', { class: 'bg-detail', hidden: true });
      el.append(detail);
    }
    const inspect = (c) => {
      const i = Number(c.dataset.i);
      if (lines) { pin(i); said.textContent = [...lines[i].children].map((x) => x.textContent.trim()).join(': '); return lines[i]; }
      const t = detailText(c); detail.textContent = t; detail.hidden = !t; said.textContent = t;
      for (const cells of refs.values()) cells.forEach((x) => x.classList.toggle('is-focus', x === c));
      return detail;
    };
    row.addEventListener('keydown', (e) => {
      const c = e.target.closest('.cell[data-i]');
      if (!c) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); e.stopPropagation();
        const box = inspect(c);
        if (box && box.scrollIntoView) box.scrollIntoView({ block: 'nearest' });
        return;
      }
      const i = Number(c.dataset.i), r = i % 4, col = i >> 2;
      const moves = { ArrowLeft: [r, col - 1], ArrowRight: [r, col + 1], ArrowUp: [r - 1, col], ArrowDown: [r + 1, col], Home: [r, 0], End: [r, 3] };
      if (!moves[e.key]) return;
      e.preventDefault(); e.stopPropagation(); // the player's arrow-key shortcuts must not fire while inspecting bytes
      const [nr, nc] = moves[e.key];
      if (nr < 0 || nr > 3 || nc < 0 || nc > 3) return;
      const cells = [...refs.values()].find((cs) => cs.includes(c));
      const j = nr + 4 * nc;
      cells.forEach((x, k) => { x.tabIndex = k === j ? 0 : -1; });
      cells[j].focus();
    });
    row.addEventListener('focusin', (e) => {
      const c = e.target.closest('.cell[data-i]');
      if (!c) return;
      inspect(c);
    });
    if (!lines) row.addEventListener('click', (e) => { const c = e.target.closest('.cell[data-i]'); if (c) inspect(c); });

    el.afterMount = () => {
      const bCells = first && refs.get(first), aCells = outItem && refs.get(outItem);
      if (!op || !bCells || !aCells) {
        // Generic: output bytes that differ from the first state flip in.
        if (first && outItem && first !== outItem) {
          stagger(COLMAJOR.filter((i) => first.bytes[i] !== outItem.bytes[i]).map((i) => aCells[i]),
            [{ transform: 'rotateX(90deg)', opacity: 0.2 }, { transform: 'none', opacity: 1 }], { duration: 300, each: 45, maxTotal: 700, delay: 200 });
        }
        return;
      }
      const flipIn = [{ transform: 'rotateX(90deg)', opacity: 0 }, { transform: 'none', opacity: 1 }];
      if (lookup || op === 'AddRoundKey') {
        let start = 0;
        if (op === 'AddRoundKey' && keyItem) {
          // Slide the key grid over the state, hold, slide back.
          const kFig = refs.get(keyItem)[0].closest('.bg-state'), sFig = bCells[0].closest('.bg-state');
          const dx = sFig.getBoundingClientRect().left - kFig.getBoundingClientRect().left;
          const dy = sFig.getBoundingClientRect().top - kFig.getBoundingClientRect().top;
          animate(kFig, [{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px)`, opacity: 0.85, offset: 0.35 }, { transform: `translate(${dx}px, ${dy}px)`, opacity: 0.85, offset: 0.6 }, { transform: 'none' }],
            { duration: 900, easing: EASE.inOut, reduce: 'none' });
          start = 350;
        }
        // Sweep: byte k's highlight (Before and After cell) and its readout line share one time window, so a frame
        // paused at any moment shows the readout of exactly the byte that is highlighted. The resting pin is hidden
        // during the sweep and comes back when it ends (or when settle() finishes it).
        const slot = Math.min(60, 900 / 16);
        const on = { boxShadow: '0 0 0 2px var(--text)' }, off = { boxShadow: '0 0 0 0 transparent' };
        const sweep = [];
        COLMAJOR.forEach((i, k) => {
          const t = start + k * slot;
          const win = { duration: slot, delay: t, easing: 'linear', reduce: 'none', fill: 'none' };
          sweep.push(
            animate(bCells[i], [on, { ...on, offset: 0.999 }, off], win),
            animate(aCells[i], [on, { ...on, offset: 0.999 }, off], win),
            animate(lines[i], [{ opacity: 1 }, { opacity: 1, offset: 0.999 }, { opacity: 0 }], win));
          animate(aCells[i], flipIn, { duration: 220, delay: t + slot * 0.6 });
        });
        const live = sweep.filter(Boolean);
        if (live.length) {
          showPin(-1);
          Promise.all(live.map((a) => a.finished)).then(() => showPin(current), () => showPin(current));
        }
      } else if (op === 'ShiftRows' || op === 'InvShiftRows') {
        const pitch = aCells[4].getBoundingClientRect().left - aCells[0].getBoundingClientRect().left; // one column
        const dir = op === 'ShiftRows' ? 1 : -1; // left shift → bytes arrive from the right
        for (let r = 1; r < 4; r++) {
          for (let c = 0; c < 4; c++) {
            const i = r + 4 * c;
            const wraps = op === 'ShiftRows' ? c + r >= 4 : c - r < 0;
            const from = `translateX(${dir * r * pitch}px)`;
            animate(aCells[i], wraps
              ? [{ transform: from, opacity: 0 }, { opacity: 0, offset: 0.3 }, { transform: 'none', opacity: 1 }]
              : [{ transform: from }, { transform: 'none' }], { duration: 300 + 90 * r, delay: (r - 1) * 220, easing: EASE.inOut });
            animate(bCells[i], [{ backgroundColor: 'var(--hl)' }, { backgroundColor: 'var(--card)' }], { duration: 500, delay: (r - 1) * 220, reduce: 'none', fill: 'none' });
          }
        }
      } else if (op === 'MixColumns' || op === 'InvMixColumns') {
        for (let c = 0; c < 4; c++) {
          const t = c * 280;
          for (let r = 0; r < 4; r++) {
            const i = r + 4 * c;
            pop(bCells[i], { delay: t, fill: 'none' });
            animate(bCells[i], [{ boxShadow: '0 0 0 2px var(--out)' }, { boxShadow: '0 0 0 0 transparent' }], { duration: 420, delay: t, reduce: 'none', fill: 'none' });
            animate(aCells[i], [{ transform: 'rotateY(90deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, delay: t + 150 + r * 30 });
          }
        }
      }
    };
    return el;
  },
};
