function collapseWhitespace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function normalizeLocationText(s) {
  return collapseWhitespace(s).toLowerCase();
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Keep slug format stable across the app:
// - trim
// - collapse multiple spaces
// - lowercase
// - remove non [a-z0-9-]
// - collapse multiple hyphens
function slugifyLocationName(name) {
  return collapseWhitespace(name)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function locationPhraseFromSlug(slug) {
  return collapseWhitespace(String(slug || '').replace(/-/g, ' '));
}

function buildLoosePhraseRegex(phrase) {
  const normalizedPhrase = collapseWhitespace(phrase);
  if (!normalizedPhrase) return null;

  // Allow any whitespace between words (handles double spaces / tabs in data)
  const parts = normalizedPhrase.split(' ').map(escapeRegex).filter(Boolean);
  if (parts.length === 0) return null;

  return new RegExp(parts.join('\\s+'), 'i');
}

function buildTokenAndQuery(tokens, fields) {
  const meaningful = tokens
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  if (meaningful.length === 0) return null;

  return {
    $and: meaningful.map((t) => {
      const rx = new RegExp(escapeRegex(t), 'i');
      return { $or: fields.map((f) => ({ [f]: rx })) };
    }),
  };
}

function buildLocationMatchQueryFromSlug(slug) {
  const phrase = locationPhraseFromSlug(slug);
  const phraseRegex = buildLoosePhraseRegex(phrase);

  const fields = ['locality', 'city', 'address'];
  const base = { published: true };

  if (!phraseRegex) return base;

  // Primary: phrase exists anywhere in locality/city/address
  const primary = {
    ...base,
    $or: fields.map((f) => ({ [f]: phraseRegex })),
  };

  // Secondary: token AND match (handles prefixes like "near <phrase>" better)
  const tokens = normalizeLocationText(phrase).split(' ');
  const secondary = buildTokenAndQuery(tokens, fields);

  if (!secondary) return primary;

  return { ...base, $or: [primary, { ...base, ...secondary }] };
}

module.exports = {
  collapseWhitespace,
  normalizeLocationText,
  escapeRegex,
  slugifyLocationName,
  locationPhraseFromSlug,
  buildLoosePhraseRegex,
  buildLocationMatchQueryFromSlug,
};

