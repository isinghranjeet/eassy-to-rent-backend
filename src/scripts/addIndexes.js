/**
 * Database Index Optimization Script
 * Run this script ONCE to add missing indexes to MongoDB collection
 * 
 * Usage: node src/scripts/addIndexes.js
 * 
 * Features:
 * - Adds missing indexes for performance
 * - Creates compound indexes for common queries
 * - Adds text indexes for search
 * - Does NOT modify existing data
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

const mongoURI = process.env.MONGO_URI;

const addIndexes = async () => {
  try {
    console.log('\n🗄️  Adding database indexes...\n');

    // Connect to MongoDB
    await mongoose.connect(mongoURI, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
    });

    console.log('✅ Connected to MongoDB');

    const results = [];

    // ─────────────────────────────────────────────────────────
    // ✅ User Model Indexes
    // ─────────────────────────────────────────────────────────
    console.log('\n📋 Adding User indexes...');

    try {
      await mongoose.connection.db.collection('users').createIndex({ email: 1 }, { unique: true });
      results.push('✅ users: email (unique)');
    } catch (e) {
      if (e.code === 85 || e.code === 86) {
        results.push('⚠️  users: email index already exists');
      } else throw e;
    }

    try {
      await mongoose.connection.db.collection('users').createIndex({ role: 1 });
      results.push('✅ users: role');
    } catch (e) { results.push('⚠️  users: role - ' + e.message); }

    try {
      await mongoose.connection.db.collection('users').createIndex({ status: 1 });
      results.push('✅ users: status');
    } catch (e) { results.push('⚠️  users: status - ' + e.message); }

    try {
      await mongoose.connection.db.collection('users').createIndex({ createdAt: -1 });
      results.push('✅ users: createdAt');
    } catch (e) { results.push('⚠️  users: createdAt - ' + e.message); }

    try {
      await mongoose.connection.db.collection('users').createIndex({ googleId: 1 }, { sparse: true });
      results.push('✅ users: googleId (sparse)');
    } catch (e) { results.push('⚠️  users: googleId - ' + e.message); }

    // Compound indexes
    try {
      await mongoose.connection.db.collection('users').createIndex({ status: 1, role: 1 });
      results.push('✅ users: status + role (compound)');
    } catch (e) { results.push('⚠️  users: status+role - ' + e.message); }

    try {
      await mongoose.connection.db.collection('users').createIndex({ name: 'text', email: 'text' });
      results.push('✅ users: name + email (text search)');
    } catch (e) { results.push('⚠️  users: text search - ' + e.message); }

    // ─────────────────────────────────────────────────────────
    // ✅ PGListing Model Indexes
    // ─────────────────────────────────────────────────────────
    console.log('\n📋 Adding PGListing indexes...');

    try {
      await mongoose.connection.db.collection('pglistings').createIndex({ slug: 1 }, { unique: true });
      results.push('✅ pglistings: slug (unique)');
    } catch (e) {
      if (e.code === 85 || e.code === 86) {
        results.push('⚠️  pglistings: slug index already exists');
      } else results.push('⚠️  pglistings: slug - ' + e.message);
    }

    try {
      await mongoose.connection.db.collection('pglistings').createIndex({ city: 1, published: 1, price: 1 });
      results.push('✅ pglistings: city + published + price (compound)');
    } catch (e) { results.push('⚠️  pglistings: compound - ' + e.message); }

    try {
      await mongoose.connection.db.collection('pglistings').createIndex({ type: 1, city: 1, published: 1 });
      results.push('✅ pglistings: type + city + published (compound)');
    } catch (e) { results.push('⚠️  pglistings: type compound - ' + e.message); }

    try {
      await mongoose.connection.db.collection('pglistings').createIndex({ location: '2dsphere' });
      results.push('✅ pglistings: location (2dsphere)');
    } catch (e) { results.push('⚠️  pglistings: 2dsphere - ' + e.message); }

    try {
      await mongoose.connection.db.collection('pglistings').createIndex({ name: 'text', description: 'text', address: 'text', city: 'text' });
      results.push('✅ pglistings: text search');
    } catch (e) { results.push('⚠️  pglistings: text - ' + e.message); }

    // ─────────────────────────────────────────────────────────
    // ✅ Booking Model Indexes
    // ─────────────────────────────────────────────────────────
    console.log('\n📋 Adding Booking indexes...');

    try {
      await mongoose.connection.db.collection('bookings').createIndex({ userId: 1, status: 1 });
      results.push('✅ bookings: userId + status');
    } catch (e) { results.push('⚠️  bookings: userId+status - ' + e.message); }

    try {
      await mongoose.connection.db.collection('bookings').createIndex({ pgId: 1, checkInDate: 1 });
      results.push('✅ bookings: pgId + checkInDate');
    } catch (e) { results.push('⚠️  bookings: pgId+date - ' + e.message); }

    try {
      await mongoose.connection.db.collection('bookings').createIndex({ invoiceNumber: 1 }, { unique: true });
      results.push('✅ bookings: invoiceNumber (unique)');
    } catch (e) {
      if (e.code === 85 || e.code === 86) {
        results.push('⚠️  bookings: invoiceNumber already exists');
      } else results.push('⚠️  bookings: invoice - ' + e.message);
    }

    // ─────────────────────────────────────────────────────────
    // ✅ Review Model Indexes
    // ─────────────────────────────────────────────────────────
    console.log('\n📋 Adding Review indexes...');

    try {
      await mongoose.connection.db.collection('reviews').createIndex({ user: 1, pgListing: 1 }, { unique: true });
      results.push('✅ reviews: user + pgListing (unique)');
    } catch (e) {
      if (e.code === 85 || e.code === 86) {
        results.push('⚠️  reviews: unique index already exists');
      } else results.push('⚠️  reviews: unique - ' + e.message);
    }

    try {
      await mongoose.connection.db.collection('reviews').createIndex({ pgListing: 1, rating: -1, createdAt: -1 });
      results.push('✅ reviews: pgListing + rating + createdAt');
    } catch (e) { results.push('⚠️  reviews: compound - ' + e.message); }

    // ─────────────────────────────────────────────────────────
    // ✅ Wishlist Model Indexes
    // ──────────────────────────────────────��──────────────────
    console.log('\n📋 Adding Wishlist indexes...');

    try {
      await mongoose.connection.db.collection('wishlists').createIndex({ user: 1, pg: 1 }, { unique: true });
      results.push('✅ wishlists: user + pg (unique)');
    } catch (e) {
      if (e.code === 85 || e.code === 86) {
        results.push('⚠️  wishlists: unique index already exists');
      } else results.push('⚠️  wishlists: unique - ' + e.message);
    }

    try {
      await mongoose.connection.db.collection('wishlists').createIndex({ user: 1, createdAt: -1 });
      results.push('✅ wishlists: user + createdAt');
    } catch (e) { results.push('⚠️  wishlists: user+createdAt - ' + e.message); }

    // ─────────────────────────────────────────────────────────
    // ✅ Activity Model Indexes
    // ─────────────────────────────────────────────────────────
    console.log('\n📋 Adding Activity indexes...');

    try {
      await mongoose.connection.db.collection('activities').createIndex({ createdAt: -1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // 30 days TTL
      results.push('✅ activities: createdAt (TTL 30 days)');
    } catch (e) { results.push('⚠️  activities: TTL - ' + e.message); }

    try {
      await mongoose.connection.db.collection('activities').createIndex({ type: 1, createdAt: -1 });
      results.push('✅ activities: type + createdAt');
    } catch (e) { results.push('⚠️  activities: type+createdAt - ' + e.message); }

    // ─────────────────────────────────────────────────────────
    // ✅ ContactLog Model Indexes
    // ─────────────────────────────────────────────────────────
    console.log('\n📋 Adding ContactLog indexes...');

    try {
      await mongoose.connection.db.collection('contactlogs').createIndex({ userId: 1, pgId: 1, type: 1, createdAt: -1 });
      results.push('✅ contactlogs: compound');
    } catch (e) { results.push('⚠️  contactlogs: compound - ' + e.message); }

    // ─────────────────────────────────────────────────────────
    // Results Summary
    // ─────────────────────────────────────────────────────────
    console.log('\n' + '='.repeat(50));
    console.log('📊 INDEX CREATION RESULTS:');
    console.log('='.repeat(50));

    results.forEach((r) => console.log(r));

    const successCount = results.filter((r) => r.startsWith('✅')).length;
    const skipCount = results.filter((r) => r.startsWith('⚠️')).length;

    console.log('\n' + '-'.repeat(50));
    console.log(`✅ Success: ${successCount}`);
    console.log(`⚠️  Skipped/Existing: ${skipCount}`);
    console.log('-'.repeat(50));

    console.log('\n✅ Index optimization complete!\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error adding indexes:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  addIndexes();
}

module.exports = { addIndexes };
