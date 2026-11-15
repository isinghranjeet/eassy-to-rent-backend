const mongoose = require('mongoose');

const maintenanceTicketSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pgId: { type: mongoose.Schema.Types.ObjectId, ref: 'PGListing', required: true },
  issueType: { type: String, enum: ['Plumbing', 'Electrical', 'WiFi', 'Cleaning', 'Other'], required: true },
  description: { type: String, required: true },
  priority: { type: String, enum: ['Low', 'Medium', 'High', 'Urgent'], default: 'Medium' },
  status: { type: String, enum: ['Open', 'In Progress', 'Resolved', 'Closed'], default: 'Open' }
}, { timestamps: true });

module.exports = mongoose.model('MaintenanceTicket', maintenanceTicketSchema);