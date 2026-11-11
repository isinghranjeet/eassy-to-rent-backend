const SITE_URL = (process.env.FRONTEND_URL || 'https://easytorent.in').replace(/\/+$/, '');

function makeSlug(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function truncate(value, maxLength) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function generatePGSeo(pg) {
  const slug = pg.slug || makeSlug(pg.name) || String(pg._id);
  const propertyType = pg.propertyType === 'FLT' ? 'Flat' : 'PG';
  const location = [pg.locality, pg.city].filter(Boolean).join(', ');
  const metaTitle = truncate(`${pg.name}${location ? ` in ${location}` : ''} | EasyToRent`, 70);
  const description = pg.description || `${propertyType} accommodation for rent`;
  const metaDescription = truncate(
    `Find ${propertyType} accommodation at ${pg.name}${location ? ` in ${location}` : ''}. ${description}`,
    160
  );
  const canonicalUrl = `${SITE_URL}/pg/${encodeURIComponent(slug)}`;
  const keywords = [...new Set([
    pg.name,
    pg.locality,
    pg.city,
    propertyType,
    pg.type,
    'PG accommodation',
    'rooms for rent',
  ].filter(Boolean).map((keyword) => String(keyword).trim()).filter(Boolean))];
  const image = pg.coverPhoto || pg.images?.[0] || '';
  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: pg.name,
    description: metaDescription,
    url: canonicalUrl,
    ...(image ? { image } : {}),
    address: {
      '@type': 'PostalAddress',
      ...(pg.address ? { streetAddress: pg.address } : {}),
      ...(pg.locality ? { addressLocality: pg.locality } : {}),
      ...(pg.city ? { addressRegion: pg.city } : {}),
      addressCountry: 'IN',
    },
    ...(pg.price != null ? {
      priceRange: `INR ${pg.price}`,
      offers: {
        '@type': 'Offer',
        price: pg.price,
        priceCurrency: 'INR',
      },
    } : {}),
  };

  return {
    slug,
    metaTitle,
    metaDescription,
    canonicalUrl,
    keywords,
    schemaData,
  };
}

function fillMissingPGSeo(pg) {
  const generated = generatePGSeo(pg);
  const current = pg.seo?.toObject ? pg.seo.toObject() : (pg.seo || {});

  pg.seo = {
    ...generated,
    ...current,
    slug: current.slug || generated.slug,
    metaTitle: current.metaTitle || generated.metaTitle,
    metaDescription: current.metaDescription || generated.metaDescription,
    canonicalUrl: current.canonicalUrl || generated.canonicalUrl,
    keywords: current.keywords?.length ? current.keywords : generated.keywords,
    schemaData: current.schemaData || generated.schemaData,
  };
}

module.exports = { fillMissingPGSeo };
