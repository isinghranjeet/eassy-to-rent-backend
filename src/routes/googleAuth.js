const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Adjust path as needed

router.post('/auth/google', async (req, res) => {
  try {
    const { code } = req.body;
    
    console.log('Received Google code:', code);
    
    // Exchange code for access token
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: process.env.VITE_GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${process.env.FRONTEND_URL}/auth-callback`,
      grant_type: 'authorization_code'
    });
    
    const { access_token } = tokenResponse.data;
    
    // Get user info using access token
    const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    });
    
    const { email, name, id: googleId, picture } = userInfoResponse.data;
    
    console.log('Google user info:', { email, name, googleId });
    
    // Find or create user in database
    let user = await User.findOne({ email });
    
    if (!user) {
      user = new User({
        name: name || email.split('@')[0],
        email,
        googleId,
        avatar: picture,
        isVerified: true,
        password: Math.random().toString(36) + Math.random().toString(36)
      });
      await user.save();
      console.log('New user created:', user.email);
    } else {
      // Update googleId if not present
      if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
      }
      console.log('Existing user found:', user.email);
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user._id, 
        email: user.email, 
        role: user.role || 'user' 
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role || 'user',
          avatar: user.avatar
        },
        token
      }
    });
    
  } catch (error) {
    console.error('Google auth error:', error.response?.data || error.message);
    res.status(401).json({
      success: false,
      message: error.response?.data?.error_description || error.message || 'Google authentication failed'
    });
  }
});