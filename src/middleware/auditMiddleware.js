const AuditLog = require('../models/AuditLog');

const auditLog = (action, getDetails = null) => async (req, res, next) => {
  const startTime = Date.now();
  
  // Store original end function
  const originalEnd = res.end;
  const originalJson = res.json;
  
  // Capture response data
  let responseData = null;
  res.json = function(data) {
    responseData = data;
    return originalJson.call(this, data);
  };
  
  res.end = function() {
    const duration = Date.now() - startTime;
    
    // Only log if user is authenticated
    if (req.user && req.user._id) {
      const details = getDetails ? getDetails(req, responseData) : {
        method: req.method,
        url: req.url,
        body: req.body,
        statusCode: res.statusCode,
        duration: `${duration}ms`
      };
      
      AuditLog.create({
        action,
        userId: req.user._id,
        userName: req.user.name || req.user.email,
        userRole: req.user.role || 'user',
        ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        details,
        status: res.statusCode >= 200 && res.statusCode < 400 ? 'success' : 'failed'
      }).catch(err => console.error('Audit log error:', err));
    }
    
    originalEnd.call(this);
  };
  
  next();
};

// Pre-defined audit actions
const auditActions = {
  USER_LOGIN: 'login',
  USER_LOGOUT: 'logout',
  USER_CREATE: 'user_create',
  USER_UPDATE: 'user_update',
  USER_DELETE: 'user_delete',
  USER_SUSPEND: 'user_suspend',
  USER_ACTIVATE: 'user_activate',
  PG_CREATE: 'pg_create',
  PG_UPDATE: 'pg_update',
  PG_DELETE: 'pg_delete',
  PG_VERIFY: 'pg_verify',
  BOOKING_CREATE: 'booking_create',
  BOOKING_CANCEL: 'booking_cancel',
  OFFER_SENT: 'offer_sent',
  REMINDER_SENT: 'reminder_sent',
  EXPORT_DATA: 'export_data',
  SETTINGS_CHANGE: 'settings_change'
};

module.exports = { auditLog, auditActions };