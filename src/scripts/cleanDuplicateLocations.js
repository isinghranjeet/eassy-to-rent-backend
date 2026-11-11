require('dotenv').config();
const mongoose = require('mongoose');
const Location = require('../models/Location');
const PGListing = require('../models/PGListing');
const { ensureLocation, syncLocationMetadata } = require('../utils/locationUtils');

const SLUG_MERGE_MAP = Object.freeze({
  'chandigarah-university-kharar': {
    targetSlug: 'chandigarh-university-kharar',
    locality: 'Chandigarh University',
    city: 'Kharar',
  },
  'chandigarh-university-ghauran': {
    targetSlug: 'chandigarh-university-kharar',
    locality: 'Chandigarh University',
    city: 'Kharar',
  },
  'chandigarh-university-chandigarh': {
    targetSlug: 'chandigarh-university-kharar',
    locality: 'Chandigarh University',
    city: 'Kharar',
  },
  'kharar-chandigarh-university': {
    targetSlug: 'chandigarh-university-kharar',
    locality: 'Chandigarh University',
    city: 'Kharar',
  },
  'near-chandigarh-university-chandigarh-university-gate-no-3': {
    targetSlug: 'cu-gate-3-kharar',
    locality: 'CU Gate 3',
    city: 'Kharar',
  },
});

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing in environment variables');
  }

  await mongoose.connect(process.env.MONGO_URI);
  const affectedTargets = new Set();
  let totalListingsUpdated = 0;
  let totalObsoleteLocationsDeleted = 0;

  for (const [badSlug, target] of Object.entries(SLUG_MERGE_MAP)) {
    console.log(`[cleanDuplicateLocations] Processing ${badSlug} -> ${target.targetSlug}`);

    const { location: targetLocation } = await ensureLocation(target.locality, target.city);
    if (targetLocation.slug !== target.targetSlug) {
      throw new Error(
        `Canonical slug mismatch: expected "${target.targetSlug}", got "${targetLocation.slug}"`
      );
    }

    const updateResult = await PGListing.updateMany(
      { locationSlug: badSlug },
      {
        $set: {
          locationSlug: target.targetSlug,
          locationId: targetLocation._id,
          locality: target.locality,
          city: target.city,
        },
      }
    );
    const updatedListings = updateResult.modifiedCount ?? updateResult.nModified ?? 0;
    totalListingsUpdated += updatedListings;
    console.log(`[cleanDuplicateLocations] Updated ${updatedListings} listing(s)`);

    const deleteResult = await Location.deleteOne({ slug: badSlug });
    const deletedLocations = deleteResult.deletedCount || 0;
    totalObsoleteLocationsDeleted += deletedLocations;
    console.log(`[cleanDuplicateLocations] Deleted ${deletedLocations} obsolete location record(s)`);

    affectedTargets.add(target.targetSlug);
  }

  for (const targetSlug of affectedTargets) {
    await syncLocationMetadata(targetSlug);
    console.log(`[cleanDuplicateLocations] Refreshed metadata for ${targetSlug}`);
  }

  console.log(JSON.stringify({
    migration: 'cleanDuplicateLocations',
    mappingCount: Object.keys(SLUG_MERGE_MAP).length,
    totalListingsUpdated,
    totalObsoleteLocationsDeleted,
    totalTargetLocationsSynced: affectedTargets.size,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error('[cleanDuplicateLocations] Failed:', error?.message || String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
