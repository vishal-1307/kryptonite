// Flat line icons (24×24, 1.75 stroke, currentColor) in the same plain geometric style as the logo. No emoji.
const wrap = (body, fill = false) => `<svg viewBox="0 0 24 24" width="20" height="20" ${fill ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"'} aria-hidden="true" focusable="false">${body}</svg>`;
export const ICON = {
  all: wrap('<rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/>'),
  'classical-ciphers': wrap('<path d="M5 20h14M6 20V9M10 20V9M14 20V9M18 20V9M4 9h16L12 4z"/>'),
  'modern-cryptography': wrap('<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>'),
  'hashing-encoding': wrap('<path d="M9.5 4 8 20M16 4l-1.5 16M4.5 9h15M4 15h15"/>'),
  caesar: wrap('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 3.5v4M12 16.5v4"/>'),
  vigenere: wrap('<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M4 9.3h16M9.3 4v16M8 20 20 8"/>'),
  playfair: wrap('<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16"/>'),
  railfence: wrap('<path d="M3 7l4.5 10L12 7l4.5 10L21 7"/>'),
  hill: wrap('<path d="M7 4H4.5v16H7M17 4h2.5v16H17"/><path d="M9 9h.01M15 9h.01M9 15h.01M15 15h.01" stroke-width="3"/>'),
  aes: wrap('<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M12 4v16M4 12h16"/><path d="M14.5 14.5h3v3h-3z"/>'),
  rsa: wrap('<rect x="5" y="10.5" width="14" height="9.5" rx="1.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14v2.5"/>'),
  diffiehellman: wrap('<circle cx="5.5" cy="12" r="2.5"/><circle cx="18.5" cy="12" r="2.5"/><path d="M8 10.5h8l-2-2M16 13.5H8l2 2"/>'),
  sha256: wrap('<path d="M7 8c2-3 8-3 10 0M5 11.5c2.5-5 11.5-5 14 0M8 13c0-4 8-4 8 0 0 3-1 5-2 7M11 14.5c0 2-.5 4-1.5 5.5M12.8 12.5c.4 2.5 0 5-1 7.5"/>'),
  base64: wrap('<path d="M8 4c-2 0-2.5 1-2.5 3v2c0 1.5-.8 2.5-2 3 1.2.5 2 1.5 2 3v2c0 2 .5 3 2.5 3M16 4c2 0 2.5 1 2.5 3v2c0 1.5.8 2.5 2 3-1.2.5-2 1.5-2 3v2c0 2-.5 3-2.5 3"/><path d="M10 12h.01M14 12h.01" stroke-width="3"/>'),
  collapse: wrap('<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M9.5 4.5v15M15.5 10l-2 2 2 2"/>'),
  expand: wrap('<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M9.5 4.5v15M13.5 10l2 2-2 2"/>'),
  menu: wrap('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  close: wrap('<path d="M6 6l12 12M18 6 6 18"/>'),
  copy: wrap('<rect x="8.5" y="8.5" width="11" height="11" rx="1.5"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>'),
  check: wrap('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
};
/** Icon for a method or group id; unknown ids get a neutral square so new methods still have one. */
export const iconFor = (id) => ICON[id] || wrap('<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 12h6"/>');
