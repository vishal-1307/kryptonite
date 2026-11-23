// Copy text to the clipboard: async Clipboard API first, then the legacy execCommand('copy') on a hidden
// textarea (works on http:// and older browsers). Resolves to { ok, method } and never throws.
export async function copyText(text, doc = typeof document !== 'undefined' ? document : null) {
  const value = String(text ?? '');
  if (!value) return { ok: false, method: 'none', reason: 'Nothing to copy' };
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(value);
      return { ok: true, method: 'clipboard' };
    }
  } catch { /* permission denied or insecure context → fall back */ }
  if (!doc || typeof doc.execCommand !== 'function') return { ok: false, method: 'none', reason: 'Copying is not supported here. Select the text and copy it by hand.' };
  const ta = doc.createElement('textarea');
  ta.value = value;
  ta.setAttribute('readonly', '');
  ta.className = 'clip-helper';
  doc.body.append(ta);
  const prev = doc.activeElement;
  ta.select();
  let ok = false;
  try { ok = doc.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  if (prev && typeof prev.focus === 'function') prev.focus({ preventScroll: true });
  return ok ? { ok: true, method: 'execCommand' } : { ok: false, method: 'execCommand', reason: 'Copy was blocked by the browser. Select the text and copy it by hand.' };
}

/** What the output Copy button may copy: only a real result, never an error message or a placeholder. */
export function copyableOutput({ raw, isError }) {
  if (isError) return null;
  const v = raw == null ? '' : String(raw);
  return v.length ? v : null;
}
