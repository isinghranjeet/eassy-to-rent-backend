const mongoose = require('mongoose');

// Counter collection for atomic sequences (restart-safe)
// Example keys:
// - 'propertyNumber:PG'
// - 'propertyNumber:FLT'
const counterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

const Counter = mongoose.model('Counter', counterSchema);

module.exports = Counter;

