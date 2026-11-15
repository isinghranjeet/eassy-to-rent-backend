const mongoose = require('mongoose');

const payoutLedgerSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  totalRent: { type: Number, required: true },
  platformCommission: { type: Number, required: true }, // e.g., 5%
  netPayoutToOwner: { type: Number, required: true },
  status: { type: String, enum: ['Pending', 'Processed', 'Failed'], default: 'Pending' },
  payoutDate: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('PayoutLedger', payoutLedgerSchema);