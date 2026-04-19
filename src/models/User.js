const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: false  // ✅ Changed to false - Google login users may not have password
  },
  phone: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'owner'],
    default: 'user'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  profileImage: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    default: ''
  },
  lastLogin: {
    type: Date,
    default: null
  },
  otp: {
    type: String,
    default: null
  },
  otpExpires: {
    type: Date,
    default: null
  },
  
  // ✅ GOOGLE LOGIN FIELDS (ADD THESE)
  googleId: {
    type: String,
    unique: true,
    sparse: true,  // Allows multiple null values
    default: null
  },
  avatar: {
    type: String,
    default: ''
  },
  isSocialLogin: {
    type: Boolean,
    default: false
  },
  
  wishlist: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PGListing',
    }
  ],
  compare: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PGListing',
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password & update timestamps on save (only if password exists)
userSchema.pre('save', async function (next) {
  this.updatedAt = Date.now();

  // Only hash password if it exists and is modified
  if (!this.isModified('password') || !this.password) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);

  next();
});

// Remove password when converting to JSON
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.otp;
  delete user.otpExpires;
  return user;
};

// Compare password method (only if user has password)
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;