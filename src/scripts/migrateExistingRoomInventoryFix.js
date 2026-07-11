/**
 * One-time migration to fix existing room availability data.
 *
 * Goal:
 *  - For every EXISTING room entry inside PGListing.roomInventory,
 *    set:
 *      totalRooms: 10
 *      availableRooms: 10
 *      occupiedRooms: 0
 *    AND also set legacy fields used by current availability code:
 *      total: 10
 *      available: 10
 *
 * Constraints:
 *  - Does NOT create new room records.
 *  - Does NOT reset/delete bookings.
 *  - Does NOT modify owner registration flow.
 *  - Does NOT change future room creation logic.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const PGListing = require('../models/PGListing');

const DEFAULT = {
  totalRooms: 10,
  availableRooms: 10,
  occupiedRooms: 0,
  // legacy fields used by current bookingService + bookingController
  total: 10,
  available: 10,
};

function assertPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

async function main() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) throw new Error('Missing MONGO_URI');

  await mongoose.connect(MONGO_URI);

  // Only process documents that already have a roomInventory object.
  // We intentionally do not backfill roomInventory for PGs that don't have it at all.
  const cursor = PGListing.find({
    roomInventory: { $type: 'object' },
  }).lean();

  let processedPgs = 0;
  let updatedPgs = 0;

  for await (const pg of cursor) {
    processedPgs += 1;

    const roomInventory = pg.roomInventory;
    if (!assertPlainObject(roomInventory)) continue;

    const roomTypeKeys = Object.keys(roomInventory);
    if (roomTypeKeys.length === 0) continue;

    // Build $set update for existing room types only.
    // Example path: roomInventory."Single Occupancy".total
    const $set = {};
    for (const roomTypeKey of roomTypeKeys) {
      const base = `roomInventory.${roomTypeKey}`;
      $set[`${base}.totalRooms`] = DEFAULT.totalRooms;
      $set[`${base}.availableRooms`] = DEFAULT.availableRooms;
      $set[`${base}.occupiedRooms`] = DEFAULT.occupiedRooms;

      // legacy fields
      $set[`${base}.total`] = DEFAULT.total;
      $set[`${base}.available`] = DEFAULT.available;
    }

    const res = await PGListing.updateOne(
      { _id: pg._id },
      { $set }
    );

    // matchedCount always equals 1 if pg exists.
    if (res.modifiedCount > 0) updatedPgs += 1;
  }

  // Verification:
  // Find any PG where roomInventory exists and any room entry does not match the expected values.
  // Because roomInventory is a Mixed object, we can't easily validate all room types
  // with a single query. Instead, we validate in JS after fetching candidates.

  const verifyCursor = PGListing.find({
    roomInventory: { $type: 'object' },
  }).lean();

  let failingPgs = 0;
  const failingSamples = [];

  for await (const pg of verifyCursor) {
    const roomInventory = pg.roomInventory;
    if (!assertPlainObject(roomInventory)) continue;

    const roomTypeKeys = Object.keys(roomInventory);
    if (roomTypeKeys.length === 0) continue;

    let ok = true;

    for (const roomTypeKey of roomTypeKeys) {
      const room = roomInventory[roomTypeKey];
      if (!assertPlainObject(room)) {
        ok = false;
        break;
      }

      const checks = [
        ['totalRooms', DEFAULT.totalRooms],
        ['availableRooms', DEFAULT.availableRooms],
        ['occupiedRooms', DEFAULT.occupiedRooms],
        ['total', DEFAULT.total],
        ['available', DEFAULT.available],
      ];

      for (const [field, expected] of checks) {
        if (Number(room[field]) !== expected) {
          ok = false;
          break;
        }
      }

      if (!ok) break;
    }

    if (!ok) {
      failingPgs += 1;
      if (failingSamples.length < 20) {
        failingSamples.push({
          pgId: pg._id.toString(),
          roomTypeKeys,
        });
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        migration: 'migrateExistingRoomInventoryFix',
        processedPgs,
        updatedPgs,
        verification: {
          failingPgs,
          failingSamples,
          expected: DEFAULT,
        },
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

