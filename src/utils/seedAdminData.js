const AuditLog = require('../models/AuditLog');
const AdminNotification = require('../models/AdminNotification');
const User = require('../models/User');
const PGListing = require('../models/PGListing');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const logger = require('./logger');

const SAMPLE_NOTIFICATIONS = [
  {
    title: 'New PG Listing Submitted',
    message: 'A new PG "Sunrise Residency" has been submitted for approval in Mohali.',
    type: 'info',
    read: false,
    link: '/admin/pgs',
    icon: 'Building'
  },
  {
    title: 'Payment Received',
    message: 'Razorpay payment of ₹12,500 received for booking #BK-8921.',
    type: 'success',
    read: false,
    link: '/admin/bookings',
    icon: 'CreditCard'
  },
  {
    title: 'Review Flagged',
    message: 'A review on "Green View PG" was flagged for inappropriate content.',
    type: 'warning',
    read: false,
    link: '/admin/reviews',
    icon: 'Flag'
  },
  {
    title: 'Server Backup Completed',
    message: 'Daily automated backup completed successfully at 03:00 AM.',
    type: 'success',
    read: true,
    link: '/admin/settings',
    icon: 'Database'
  },
  {
    title: 'User Account Suspended',
    message: 'User rahul.sharma@example.com was suspended due to multiple violations.',
    type: 'alert',
    read: false,
    link: '/admin/users',
    icon: 'UserX'
  },
  {
    title: 'Low Inventory Alert',
    message: 'Only 2 single rooms left at "City Heights PG" in Sector 22.',
    type: 'warning',
    read: false,
    link: '/admin/pgs',
    icon: 'AlertTriangle'
  },
  {
    title: 'New Admin Login',
    message: 'Admin logged in from IP 203.192.12.45 at 09:15 AM.',
    type: 'info',
    read: true,
    link: '/admin/activity',
    icon: 'LogIn'
  },
  {
    title: 'Weekly Report Generated',
    message: 'Weekly analytics report has been generated and emailed.',
    type: 'success',
    read: true,
    link: '/admin/stats',
    icon: 'BarChart'
  }
];

const SAMPLE_AUDIT_ACTIONS = [
  { action: 'login', userName: 'Admin User', userRole: 'admin', status: 'success', details: { ip: '203.192.12.45', device: 'Chrome / Windows' } },
  { action: 'pg_create', userName: 'Vikram Singh', userRole: 'owner', status: 'success', details: { pgName: 'Sunrise Residency', city: 'Mohali' } },
  { action: 'booking_create', userName: 'Rahul Sharma', userRole: 'user', status: 'success', details: { bookingId: 'BK-8921', amount: 12500 } },
  { action: 'user_create', userName: 'Priya Patel', userRole: 'user', status: 'success', details: { source: 'email_signup' } },
  { action: 'settings_change', userName: 'Admin User', userRole: 'admin', status: 'success', details: { setting: 'email_notifications', value: 'enabled' } },
  { action: 'pg_verify', userName: 'Admin User', userRole: 'admin', status: 'success', details: { pgName: 'Green View PG', city: 'Chandigarh' } },
  { action: 'user_suspend', userName: 'Admin User', userRole: 'admin', status: 'success', details: { userEmail: 'rahul.sharma@example.com', reason: 'policy_violation' } },
  { action: 'export_data', userName: 'Admin User', userRole: 'admin', status: 'success', details: { format: 'csv', entity: 'bookings' } },
  { action: 'review_create', userName: 'Ankit Kumar', userRole: 'user', status: 'success', details: { pgName: 'City Heights PG', rating: 4 } },
  { action: 'reminder_sent', userName: 'System', userRole: 'admin', status: 'success', details: { type: 'wishlist', recipients: 12 } },
  { action: 'login', userName: 'Neha Gupta', userRole: 'owner', status: 'success', details: { ip: '45.120.89.11', device: 'Safari / iOS' } },
  { action: 'booking_cancel', userName: 'Rahul Sharma', userRole: 'user', status: 'success', details: { bookingId: 'BK-8812', reason: 'changed_mind' } },
  { action: 'pg_update', userName: 'Vikram Singh', userRole: 'owner', status: 'success', details: { pgName: 'Sunrise Residency', field: 'price' } },
  { action: 'user_update', userName: 'Priya Patel', userRole: 'user', status: 'success', details: { field: 'phone', value: '9876543210' } },
  { action: 'login', userName: 'Admin User', userRole: 'admin', status: 'failed', details: { ip: '192.168.1.105', reason: 'invalid_password' } }
];

/**
 * Seed admin notifications if collection is empty
 */
const seedAdminNotifications = async () => {
  try {
    const count = await AdminNotification.countDocuments();
    if (count > 0) {
      logger.info('AdminNotification collection already has data, skipping seed');
      return;
    }

    await AdminNotification.insertMany(SAMPLE_NOTIFICATIONS);
    logger.info('✅ Admin notifications seeded successfully');
  } catch (error) {
    logger.error('❌ Error seeding admin notifications:', error.message);
  }
};

/**
 * Seed audit logs if collection is empty
 */
const seedAuditLogs = async () => {
  try {
    const count = await AuditLog.countDocuments();
    if (count > 0) {
      logger.info('AuditLog collection already has data, skipping seed');
      return;
    }

    // Generate timestamps over the last 7 days for realistic distribution
    const now = new Date();
    const logs = SAMPLE_AUDIT_ACTIONS.map((log, index) => {
      const hoursAgo = (index * 3) + Math.floor(Math.random() * 6);
      const createdAt = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
      return { ...log, createdAt };
    });

    await AuditLog.insertMany(logs);
    logger.info('✅ Audit logs seeded successfully');
  } catch (error) {
    logger.error('❌ Error seeding audit logs:', error.message);
  }
};

/**
 * Seed all admin data (idempotent)
 */
const seedAllAdminData = async () => {
  await seedAdminNotifications();
  await seedAuditLogs();
};

module.exports = {
  seedAdminNotifications,
  seedAuditLogs,
  seedAllAdminData
};

