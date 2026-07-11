/**
 * One-time migration to backfill roomInventory for existing PG documents.
 *
 * Usage:
 *  - node src/scripts/migrateRoomInventory.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const PGListing = require('../models/PGListing');

const DEFAULT_INVENTORY = {
  'Single Occupancy': { total: 1, available: 1 },
  'Double Sharing': { total: 1, available: 1 },
  'Triple Sharing': { total: 1, available: 1 },
  'Four Sharing': { total: 1, available: 1 },
};

async function main() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) throw new Error('Missing MONGO_URI');

  await mongoose.connect(MONGO_URI);

  const cursor = PGListing.find({ $or: [{ roomInventory: { $exists: false } }, { roomInventory: null }, { roomInventory: {} }] });

  let processed = 0;
  let updated = 0;

  for await (const pg of cursor.lean()) {
    processed += 1;

    const roomInventory = pg.roomInventory && typeof pg.roomInventory === 'object' ? pg.roomInventory : {};

    // If roomInventory exists but is empty, seed defaults.
    const hasAny = Object.keys(roomInventory).length > 0;

    if (!hasAny) {
      await PGListing.updateOne(
        { _id: pg._id },
        { $set: { roomInventory: DEFAULT_INVENTORY } }
      );
      updated += 1;
    }
  }

  console.log(JSON.stringify({ processed, updated }, null, 2));
  await mongoose.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

