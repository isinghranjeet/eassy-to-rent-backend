require('dotenv').config();
const mongoose = require('mongoose');
const Location = require('../models/Location');
const PGListing = require('../models/PGListing');
const {
  ensureLocation,
  generateLocationSlug,
  syncLocationMetadata,
} = require('../utils/locationUtils');

async function removeLegacyUniqueNameIndex() {
  let indexes;
  try {
    indexes = await Location.collection.indexes();
  } catch (error) {
    if (error.code === 26 || error.codeName === 'NamespaceNotFound') return;
    throw error;
  }
  const legacyIndex = indexes.find((index) =>
    index.unique &&
    Object.keys(index.key || {}).length === 1 &&
    index.key.name === 1
  );

  if (legacyIndex) {
    await Location.collection.dropIndex(legacyIndex.name);
    console.log(`Removed obsolete unique location-name index: ${legacyIndex.name}`);
  }
}

async function migrateLocations() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing in environment variables');
  }

  await mongoose.connect(process.env.MONGO_URI);
  await removeLegacyUniqueNameIndex();
  await Location.collection.createIndex({ slug: 1 }, { unique: true });
  await PGListing.collection.createIndex({ locationSlug: 1 });

  const locationSlugs = new Set();
  let totalProperties = 0;
  let totalPropertiesUpdated = 0;
  let totalLocationsCreated = 0;
  let totalPropertiesSkipped = 0;

  const cursor = PGListing.find({})
    .select('_id locality city availability')
    .lean()
    .cursor();

  for await (const property of cursor) {
    totalProperties += 1;
    const city = String(property.city || '').trim();
    const locality = String(property.locality || '').trim();

    if (!city) {
      totalPropertiesSkipped += 1;
      console.warn(`Skipping property ${property._id}: city is missing`);
      continue;
    }

    const locationSlug = generateLocationSlug(locality, city);
    const { location, created } = await ensureLocation(locality, city);
    if (created) totalLocationsCreated += 1;

    const propertyUpdate = {
      locationSlug,
      locationId: location._id,
      city,
      locality,
    };
    if (property.availability) {
      propertyUpdate.availability = String(property.availability).trim().toLowerCase();
    }

    const result = await PGListing.updateOne(
      { _id: property._id },
      {
        $set: propertyUpdate,
      }
    );

    if (result.modifiedCount > 0) totalPropertiesUpdated += 1;
    locationSlugs.add(locationSlug);
  }

  for (const slug of locationSlugs) {
    await syncLocationMetadata(slug);
  }

  console.log(JSON.stringify({
    migration: 'migrateLocations',
    totalProperties,
    totalPropertiesUpdated,
    totalLocationsCreated,
    totalLocationsSynced: locationSlugs.size,
    totalPropertiesSkipped,
  }, null, 2));
}

migrateLocations()
  .catch((error) => {
    console.error('Location migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
