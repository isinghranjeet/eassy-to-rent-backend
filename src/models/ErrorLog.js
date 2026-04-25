const mongoose = require('mongoose');

const ErrorLogSchema = new mongoose.Schema(
  {
    message: {
      type: String,
      required: true,
    },
    stack: {
      type: String,
      default: null,
    },
    path: {
      type: String,
      default: null,
    },
    method: {
      type: String,
      default: null,
    },
    statusCode: {
      type: Number,
      default: 500,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('ErrorLog', ErrorLogSchema);
