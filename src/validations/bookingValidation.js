const Joi = require('joi');

const createBookingSchema = Joi.object({
  pgId: Joi.string().trim().required(),

  // Backward compatible: if frontend doesn't send, default will be applied.
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
}).custom((value, helpers) => {
  const checkIn = new Date(value.checkInDate);
  const checkOut = new Date(value.checkOutDate);

  if (!(checkIn instanceof Date) || isNaN(checkIn.getTime())) {
    return helpers.error('any.invalid');
  }
  if (!(checkOut instanceof Date) || isNaN(checkOut.getTime())) {
    return helpers.error('any.invalid');
  }
  if (checkOut.getTime() <= checkIn.getTime()) {
    return helpers.error('any.custom', { message: 'checkOutDate must be after checkInDate' });
  }

  if (!Number.isFinite(value.durationMonths) || value.durationMonths <= 0) {
    return helpers.error('any.custom', { message: 'durationMonths must be > 0' });
  }

  return value;
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
