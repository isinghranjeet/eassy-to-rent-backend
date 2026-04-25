const cacheHeaders = (req, res, next) => {
  if (req.method === 'GET') {
    // Browser + service worker friendly cache defaults.
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  } else {
    res.set('Cache-Control', 'no-store');
  }

  next();
};

module.exports = cacheHeaders;
