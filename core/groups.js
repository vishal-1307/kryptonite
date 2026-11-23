// Sidebar / home grouping (pure). Registry categories stay as they are; unknown categories get their own group,
// so a new method shows up (and is counted) without touching this file.
export const GROUPS = [
  { slug: 'classical-ciphers', name: 'Classical Ciphers', cats: ['Classical'] },
  { slug: 'modern-cryptography', name: 'Modern Cryptography', cats: ['Symmetric', 'Asymmetric', 'Key Exchange'] },
  { slug: 'hashing-encoding', name: 'Hashing & Encoding', cats: ['Hashing', 'Encoding'] },
];
export const slugify = (c) => String(c).toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** [{ slug, name, methods: [...] }] in display order, empty groups dropped. */
export function groupMethods(methods, categoryOrder = []) {
  const known = new Set(GROUPS.flatMap((g) => g.cats));
  const extraCats = [...categoryOrder, ...methods.map((m) => m.category)].filter((c, i, a) => !known.has(c) && a.indexOf(c) === i);
  return [
    ...GROUPS.map((g) => ({ slug: g.slug, name: g.name, methods: methods.filter((m) => g.cats.includes(m.category)) })),
    ...extraCats.map((c) => ({ slug: slugify(c), name: c, methods: methods.filter((m) => m.category === c) })),
  ].filter((g) => g.methods.length);
}
export const groupOf = (groups, id) => groups.find((g) => g.methods.some((m) => m.id === id)) || null;
