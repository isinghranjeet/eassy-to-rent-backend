const Location = require('../models/Location');
const PGListing = require('../models/PGListing');

const INACTIVE_AVAILABILITY_VALUES = ['unavailable', 'rented', 'deleted', 'occupied', 'full'];

function collapseWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeLocationText(value) {
  return collapseWhitespace(value).toLowerCase();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function slugifyLocationName(value) {
  return collapseWhitespace(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[æ]/g, 'ae')
    .replace(/[œ]/g, 'oe')
    .replace(/[ø]/g, 'o')
    .replace(/[ł]/g, 'l')
    .replace(/[đ]/g, 'd')
    .replace(/[ß]/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function generateLocationSlug(locality, city) {
  if (typeof city !== 'string' ||
      (locality !== undefined && locality !== null && typeof locality !== 'string')) {
    throw new TypeError('Location city and locality must be strings');
  }

  const citySlug = slugifyLocationName(city);
  const localitySlug = slugifyLocationName(locality);

  if (!citySlug) {
    throw new TypeError('Location city is required to generate a valid slug');
  }

  if (!localitySlug || localitySlug === citySlug) {
    return citySlug;
  }

  return `${localitySlug}-${citySlug}`;
}

async function ensureLocation(locality, city) {
  if (typeof city !== 'string' ||
      (locality !== undefined && locality !== null && typeof locality !== 'string')) {
    throw new TypeError('Location city and locality must be strings');
  }

  const cleanCity = collapseWhitespace(city);
  const cleanLocality = collapseWhitespace(locality);
  const name = cleanLocality || cleanCity;
  const slug = generateLocationSlug(cleanLocality, cleanCity);

  let location = await Location.findOne({ slug });
  if (location) {
    if (location.name !== name || location.city !== cleanCity) {
      location.name = name;
      location.city = cleanCity;
      await location.save();
    }
    return { location, created: false };
  }

  try {
    location = await Location.create({
      name,
      city: cleanCity,
      slug,
    });
    return { location, created: true };
  } catch (error) {
    if (error.code !== 11000) throw error;

    location = await Location.findOne({ slug });
    if (!location) throw error;
    return { location, created: false };
  }
}

async function syncLocationMetadata(locationSlug) {
  const slug = collapseWhitespace(locationSlug).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new TypeError('A valid location slug is required');
  }

  const location = await Location.findOne({ slug });
  if (!location) {
    throw new Error(`Location not found for slug "${slug}"`);
  }

  const [stats] = await PGListing.aggregate([
    {
      $match: {
        locationSlug: slug,
        published: true,
        availability: { $nin: INACTIVE_AVAILABILITY_VALUES },
      },
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        averageRent: { $avg: '$price' },
      },
    },
  ]);

  const totalActiveListings = stats?.count || 0;
  const averageRent = Math.round(stats?.averageRent || 0);
  const locality = collapseWhitespace(location.name);
  const city = collapseWhitespace(location.city);
  const locationLabel = slugifyLocationName(locality) === slugifyLocationName(city)
    ? city
    : `${locality}, ${city}`;

  location.totalActiveListings = totalActiveListings;
  location.pgCount = totalActiveListings;
  location.averageRent = averageRent;
  location.isIndexed = totalActiveListings > 0;
  location.metaTitle = `Flats, Rooms & PGs for Rent in ${locationLabel} | Zero Brokerage EasyToRent`;
  location.metaDescription =
    `Explore ${totalActiveListings}+ verified rental properties in ${locationLabel}. ` +
    `Average rent ₹${averageRent}/mo. Verified owners, instant WhatsApp contact, bachelor & family friendly.`;

  return location.save();
}

function locationPhraseFromSlug(slug) {
  return collapseWhitespace(String(slug || '').replace(/-/g, ' '));
}

function buildLoosePhraseRegex(phrase) {
  const normalizedPhrase = collapseWhitespace(phrase);
  if (!normalizedPhrase) return null;

  const parts = normalizedPhrase.split(' ').map(escapeRegex).filter(Boolean);
  if (parts.length === 0) return null;

  return new RegExp(parts.join('\\s+'), 'i');
}

function buildTokenAndQuery(tokens, fields) {
  const meaningful = tokens
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

  if (meaningful.length === 0) return null;

  return {
    $and: meaningful.map((token) => {
      const regex = new RegExp(escapeRegex(token), 'i');
      return { $or: fields.map((field) => ({ [field]: regex })) };
    }),
  };
}

function buildLocationMatchQueryFromSlug(slug) {
  const phrase = locationPhraseFromSlug(slug);
  const phraseRegex = buildLoosePhraseRegex(phrase);
  const fields = ['locality', 'city', 'address'];
  const base = { published: true };

  if (!phraseRegex) return base;

  const primary = {
    ...base,
    $or: fields.map((field) => ({ [field]: phraseRegex })),
  };
  const secondary = buildTokenAndQuery(normalizeLocationText(phrase).split(' '), fields);

  return secondary ? { ...base, $or: [primary, { ...base, ...secondary }] } : primary;
}

module.exports = {
  collapseWhitespace,
  normalizeLocationText,
  escapeRegex,
  slugifyLocationName,
  generateLocationSlug,
  ensureLocation,
  syncLocationMetadata,
  locationPhraseFromSlug,
  buildLoosePhraseRegex,
  buildLocationMatchQueryFromSlug,
  INACTIVE_AVAILABILITY_VALUES,
};
