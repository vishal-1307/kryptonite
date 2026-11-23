// Contained horizontal scrolling that people can discover and use without a mouse:
// any of these boxes that actually overflows gets tabindex=0 (arrow keys scroll it), a role and an aria-label
// ("…, scrolls sideways") if it has none, and edge fades (.fade-l / .fade-r) showing there is more to see.
// Boxes that fit get none of that, so the tab order stays clean.
export const SCROLLER_SELECTOR = '.stage, .step-list, pre.code, .cmd code, .rf-scroll, .v-hexdump, .table-wrap, .tabs, .tr-scroll, .v-bytegrid-scroll';
const LABELS = [
  ['.stage', 'Visualization'], ['.step-list', 'All steps'], ['pre.code', 'Source code'], ['.cmd code', 'Command'],
  ['.rf-scroll', 'Rail Fence grid'], ['.v-hexdump', 'Hex dump'], ['.table-wrap', 'Table'],
];

export function overflowState(el) {
  const x = el.scrollWidth > el.clientWidth + 1;
  const y = el.scrollHeight > el.clientHeight + 1;
  return { x, y, left: x && el.scrollLeft > 1, right: x && el.scrollLeft + el.clientWidth < el.scrollWidth - 1 };
}

function sync(el) {
  const s = overflowState(el);
  el.classList.toggle('fade-l', s.left);
  el.classList.toggle('fade-r', s.right);
  el.classList.toggle('has-overflow', s.x || s.y);
  if (el.matches('.tabs')) return; // the tabs themselves are focusable
  const managed = el.dataset.scrollManaged === '1';
  if (s.x || s.y) {
    if (!el.hasAttribute('tabindex')) { el.tabIndex = 0; el.dataset.scrollManaged = '1'; }
    if (!el.hasAttribute('aria-label')) {
      const base = (LABELS.find(([sel]) => el.matches(sel)) || [null, 'Scrollable area'])[1];
      const cap = el.querySelector('caption, figcaption');
      el.setAttribute('aria-label', `${cap && cap.textContent.trim() ? cap.textContent.trim() : base}${s.x ? ', scrolls sideways' : ', scrollable'}`);
      el.dataset.scrollLabel = '1';
    }
    if (!el.hasAttribute('role')) { el.setAttribute('role', 'region'); el.dataset.scrollRole = '1'; }
  } else if (managed) {
    el.removeAttribute('tabindex'); delete el.dataset.scrollManaged;
    if (el.dataset.scrollLabel) { el.removeAttribute('aria-label'); delete el.dataset.scrollLabel; }
    if (el.dataset.scrollRole) { el.removeAttribute('role'); delete el.dataset.scrollRole; }
  }
}

export function enhanceScrollers(root) {
  if (!root) return;
  for (const el of root.querySelectorAll(SCROLLER_SELECTOR)) {
    if (!el.dataset.scrollWired) {
      el.dataset.scrollWired = '1';
      el.addEventListener('scroll', () => sync(el), { passive: true });
    }
    sync(el);
  }
}
