const express = require('express');
const router = express.Router();

// Test route
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Auth route working ✅',
    timestamp: new Date().toISOString()
  });
});

// Register route
router.post('/register', async (req, res) => {
  try {
    console.log('Register request:', req.body);
    // For now, just return success
    res.json({
      success: true,
      message: 'User registered successfully',
      data: {
        ...req.body,
        _id: 'temp-id',
        token: 'temp-token'
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Login route
router.post('/login', async (req, res) => {
  try {
    console.log('Login request:', req.body);
    
    // Simple check for admin
    if (req.body.email === 'admin@pgfinder.com' && req.body.password === 'admin123') {
      res.json({
        success: true,
        message: 'Login successful',
        data: {
          _id: 'admin-id',
          name: 'Admin User',
          email: 'admin@pgfinder.com',
          role: 'admin',
          token: 'admin-jwt-token-123'
        }
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Create default admin
router.post('/init-admin', async (req, res) => {
  try {
    console.log('Creating default admin...');
    
    res.json({
      success: true,
      message: 'Default admin created successfully',
      data: {
        _id: 'admin-id-123',
        name: 'Admin User',
        email: 'admin@pgfinder.com',
        role: 'admin',
        token: 'admin-jwt-token-123'
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Get profile
router.get('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }
    
    // Mock user data
    res.json({
      success: true,
      data: {
        _id: 'user-id-123',
        name: 'Test User',
        email: 'test@example.com',
        role: 'user',
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Export the router
module.exports = router;