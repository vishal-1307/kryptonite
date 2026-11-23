import { h } from './dom.js';
import { ICON, iconFor } from './icons.js';

// Collapsible left sidebar (ChatGPT-desktop style).
//  • Desktop (≥900px): expanded = icons + labels + counts; collapsed = narrow icon-only rail with tooltips.
//    The choice is stored in localStorage (cv-sidebar) and applied before first paint by core/theme-boot.js.
//  • Small screens (<900px): the same nav becomes an off-canvas drawer opened from the top-bar menu button.
//    While open it is a modal dialog: focus is trapped inside, Esc / the scrim / a link closes it, and focus
//    returns to the menu button.
const DRAWER_MQ = '(max-width: 899px)';

export function createSidebar({ groups, total, prefs }) {
  const root = document.documentElement;
  const aside = document.getElementById('sidebar');
  const nav = document.getElementById('sb-nav');
  const toggle = document.getElementById('sb-toggle');
  const closeBtn = document.getElementById('sb-close');
  const menuBtn = document.getElementById('menu-btn');
  const scrim = document.getElementById('sb-scrim');
  const tip = document.getElementById('sb-tip');
  const mq = matchMedia(DRAWER_MQ);
  toggle.innerHTML = ICON.collapse; closeBtn.innerHTML = ICON.close; menuBtn.innerHTML = ICON.menu;

  const item = (href, icon, label, { count, cls = '', tipText } = {}) => h('a', {
    class: `sb-item ${cls}`, href, 'data-tip': tipText || label,
    'aria-label': count != null ? `${label}, ${count} method${count === 1 ? '' : 's'}` : label,
  }, h('span', { class: 'sb-icon', html: icon }), h('span', { class: 'sb-label' }, label), count != null ? h('span', { class: 'sb-count', 'aria-hidden': 'true' }, String(count)) : null);

  nav.replaceChildren(
    item('#/', ICON.all, 'All Methods', { count: total, cls: 'sb-all', tipText: `All Methods (${total})` }),
    ...groups.map((g) => h('div', { class: 'sb-group' },
      item(`#/c/${g.slug}`, iconFor(g.slug), g.name, { count: g.methods.length, cls: 'sb-cat', tipText: `${g.name} (${g.methods.length})` }),
      h('ul', { class: 'sb-list', 'aria-label': g.name }, g.methods.map((m) => h('li', {},
        item(`#/${m.id}`, iconFor(m.id), m.name, { cls: 'sb-method' })))))),
  );
  nav.querySelectorAll('.sb-method').forEach((a) => { a.dataset.id = a.getAttribute('href').slice(2); });

  const isDrawer = () => mq.matches;
  const collapsed = () => root.classList.contains('sb-collapsed');
  function syncToggle() {
    const c = collapsed();
    toggle.innerHTML = c ? ICON.expand : ICON.collapse;
    toggle.setAttribute('aria-expanded', String(!c));
    const label = c ? 'Expand sidebar' : 'Collapse sidebar';
    toggle.setAttribute('aria-label', label); toggle.title = label;
  }
  function setCollapsed(c, save = true) {
    root.classList.toggle('sb-collapsed', c);
    if (save) prefs.set('sidebar', c ? 'collapsed' : 'expanded');
    hideTip();
    syncToggle();
  }
  toggle.addEventListener('click', () => setCollapsed(!collapsed()));

  // ---- tooltips for the icon rail (a fixed element, so the scrolling nav never clips it)
  function showTip(a) {
    if (!collapsed() || isDrawer()) return;
    const r = a.getBoundingClientRect();
    tip.textContent = a.dataset.tip;
    tip.hidden = false;
    tip.style.top = `${Math.round(r.top + r.height / 2)}px`;
    tip.style.left = `${Math.round(r.right + 8)}px`;
  }
  function hideTip() { tip.hidden = true; }
  nav.addEventListener('pointerover', (e) => { const a = e.target.closest('.sb-item'); if (a) showTip(a); });
  nav.addEventListener('pointerout', (e) => { if (!e.relatedTarget || !nav.contains(e.relatedTarget)) hideTip(); });
  nav.addEventListener('focusin', (e) => { const a = e.target.closest('.sb-item'); if (a && a.matches(':focus-visible')) showTip(a); });
  nav.addEventListener('focusout', hideTip);
  nav.addEventListener('scroll', hideTip, { passive: true });

  // ---- drawer
  let open = false;
  const focusables = () => [...aside.querySelectorAll('a[href], button:not([disabled])')].filter((el) => el.offsetParent !== null);
  function setDrawerA11y() {
    if (isDrawer()) {
      aside.setAttribute('role', open ? 'dialog' : 'region');
      if (open) { aside.setAttribute('aria-modal', 'true'); aside.removeAttribute('inert'); } else { aside.removeAttribute('aria-modal'); aside.setAttribute('inert', ''); }
    } else { aside.removeAttribute('role'); aside.removeAttribute('aria-modal'); aside.removeAttribute('inert'); }
  }
  function openDrawer() {
    if (!isDrawer() || open) return;
    open = true;
    root.classList.add('sb-open');
    menuBtn.setAttribute('aria-expanded', 'true');
    setDrawerA11y();
    const cur = aside.querySelector('.sb-item.is-active') || focusables()[0];
    (cur || aside).focus({ preventScroll: true });
  }
  function closeDrawer(restore = true) {
    if (!open) return;
    open = false;
    root.classList.remove('sb-open');
    menuBtn.setAttribute('aria-expanded', 'false');
    setDrawerA11y();
    if (restore) menuBtn.focus({ preventScroll: true });
  }
  menuBtn.addEventListener('click', () => (open ? closeDrawer() : openDrawer()));
  closeBtn.addEventListener('click', () => closeDrawer());
  scrim.addEventListener('click', () => closeDrawer());
  aside.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeDrawer(); return; }
    if (e.key !== 'Tab') return;
    const f = focusables(); if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  nav.addEventListener('click', (e) => { if (e.target.closest('a') && open) closeDrawer(false); });
  mq.addEventListener('change', () => { if (!isDrawer()) closeDrawer(false); setDrawerA11y(); hideTip(); });
  setDrawerA11y();
  syncToggle();
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('booting')));

  return {
    setActive({ methodId = null, groupSlug = null, home = false } = {}) {
      nav.querySelectorAll('.sb-item').forEach((a) => {
        const href = a.getAttribute('href');
        const on = (methodId && href === `#/${methodId}`) || (!methodId && groupSlug && href === `#/c/${groupSlug}`) || (!methodId && !groupSlug && home && href === '#/');
        a.classList.toggle('is-active', !!on);
        if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
        // The group that holds the current method is marked too (lighter), so the context is clear in the rail.
        if (a.classList.contains('sb-cat')) a.classList.toggle('has-active', !!methodId && !!a.parentElement.querySelector(`.sb-method[data-id="${methodId}"]`));
      });
    },
    closeDrawer: () => closeDrawer(false),
    isOpen: () => open,
    setCollapsed,
  };
}
