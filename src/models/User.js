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
    required: false // Google users ke liye optional
  },

  phone: {
    type: String,
    default: ''
  },

  alternatePhone: {
    type: String,
    default: ''
  },

  whatsappNumber: {
    type: String,
    default: ''
  },

  sameWhatsappAsPrimary: {
    type: Boolean,
    default: true
  },

  businessName: {
    type: String,
    default: ''
  },

  officeAddress: {
    type: String,
    default: ''
  },

  payoutDetails: {
    upiId: { type: String, default: '' },
    accountHolderName: { type: String, default: '' },
    bankAccountNumber: { type: String, default: '' },
    ifscCode: { type: String, default: '' }
  },

  kycDetails: {
    idType: {
      type: String,
      enum: ['Aadhaar', 'Government ID', 'Driving License'],
      default: 'Government ID'
    },
    frontDocumentUrl: { type: String, default: '' },
    backDocumentUrl: { type: String, default: '' }
  },

  kyc: {
    idType: { type: String, default: '' },
    idNumber: { type: String, default: '' },
    frontDocument: { type: String, default: '' },
    backDocument: { type: String, default: '' },
    status: {
      type: String,
      enum: ['unverified', 'pending', 'verified', 'rejected'],
      default: 'unverified'
    },
    rejectionReason: { type: String, default: '' },
    submittedAt: { type: Date },
    reviewedAt: { type: Date }
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

  lastLoginIP: {
    type: String,
    default: ''
  },

  loginActivity: [
    {
      type: {
        type: String,
        default: 'LOGIN'
      },
      time: {
        type: Date,
        default: Date.now
      },
      ip: {
        type: String,
        default: ''
      },
      userAgent: {
        type: String,
        default: ''
      }
    }
  ],

  otp: {
    type: String,
    default: null
  },

  otpExpires: {
    type: Date,
    default: null
  },

  // ✅ GOOGLE LOGIN FIXED (IMPORTANT)
  googleId: {
    type: String,
    unique: true,
    sparse: true
    // ❌ default: null hata diya
  },

  avatar: {
    type: String,
    default: ''
  },

  isSocialLogin: {
    type: Boolean,
    default: false
  },

  // 💰 CREDIT SYSTEM
  credits: {
    type: Number,
    default: 0,
    min: 0
  },

  totalCreditsPurchased: {
    type: Number,
    default: 0
  },

  totalCreditsUsed: {
    type: Number,
    default: 0
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

  wishlistEmailEnabled: {
    type: Boolean,
    default: true
  },

  refreshToken: {
    type: String,
    default: null,
    select: false
  },

  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  },

  isEmailVerified: { 
    type: Boolean, 
    default: false 
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  verificationEmailSentAt: Date,
  accountRecoveryToken: String,
  accountRecoveryExpires: Date,
  failedLoginAttempts: { 
    type: Number, 
    default: 0 
  },
  lockedUntil: Date,

  // ==================== PROFILE FIELDS ====================
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer-not-to-say', ''],
    default: ''
  },
  dateOfBirth: {
    type: Date,
    default: null
  },
  occupation: {
    type: String,
    default: ''
  },
  college: {
    type: String,
    default: ''
  },
  address: {
    type: String,
    default: ''
  },
  city: {
    type: String,
    default: ''
  },
  state: {
    type: String,
    default: ''
  },
  country: {
    type: String,
    default: 'India'
  },

  // ==================== SETTINGS ====================
  emailNotifications: {
    type: Boolean,
    default: true
  },
  bookingUpdates: {
    type: Boolean,
    default: true
  },
  propertyAlerts: {
    type: Boolean,
    default: true
  },
  marketingEmails: {
    type: Boolean,
    default: false
  },
  pushNotifications: {
    type: Boolean,
    default: true
  },
  profileVisibility: {
    type: String,
    enum: ['public', 'private', 'contacts-only'],
    default: 'public'
  }

});


// 🔐 PASSWORD HASH
userSchema.pre('save', async function (next) {
  this.updatedAt = Date.now();

  if (!this.isModified('password') || !this.password) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);

  next();
});


// ❌ REMOVE SENSITIVE DATA
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.otp;
  delete user.otpExpires;
  return user;
};


// 🔑 PASSWORD COMPARE
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};


// 💰 ADD CREDITS
userSchema.methods.addCredits = async function (amount) {
  this.credits += amount;
  this.totalCreditsPurchased += amount;
  this.updatedAt = Date.now();
  await this.save();
  return this.credits;
};


// 💸 USE CREDITS
userSchema.methods.useCredits = async function (amount = 1) {
  if (this.credits < amount) {
    throw new Error('Insufficient credits');
  }

  this.credits -= amount;
  this.totalCreditsUsed += amount;
  this.updatedAt = Date.now();

  await this.save();
  return this.credits;
};


// ✅ CHECK CREDITS
userSchema.methods.hasEnoughCredits = function (amount = 1) {
  return this.credits >= amount;
};


// ✅ OPTIMIZED Indexes - Consolidated (no duplicates)
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ googleId: 1 }, { sparse: true });
userSchema.index({ role: 1, status: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ name: 'text', email: 'text' });


const User = mongoose.model('User', userSchema);

module.exports = User;