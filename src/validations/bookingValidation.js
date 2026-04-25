const Joi = require('joi');

const createBookingSchema = Joi.object({
  pgId: Joi.string().trim().required(),
  roomType: Joi.string().trim().default('Single Occupancy'),
  checkInDate: Joi.date().required(),
  checkOutDate: Joi.date().required(),
  durationMonths: Joi.number().positive().required(),
  // Server calculates totalAmount from PG price and duration.
  totalAmount: Joi.number().positive().optional(),
  guestDetails: Joi.object({
    name: Joi.string().allow('').default(''),
    phone: Joi.string().allow('').default(''),
    email: Joi.string().email().allow('').default(''),
  }).default({}),
  specialRequests: Joi.string().allow('').default(''),
});

const updateBookingStatusSchema = Joi.object({
  status: Joi.string()
    .valid('pending', 'confirmed', 'cancelled')
    .required(),
});

module.exports = {
  createBookingSchema,
  updateBookingStatusSchema,
};
