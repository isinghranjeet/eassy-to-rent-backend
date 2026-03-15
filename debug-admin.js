const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, lowercase: true, trim: true },
  password: String,
  role: String,
  status: { type: String, default: 'active' },
  otp: String,
  otpExpires: Date,
  lastLogin: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

const run = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected!\n');

    console.log(`Looking for admin: ${ADMIN_EMAIL}`);
    let admin = await User.findOne({ email: ADMIN_EMAIL }).select('+password');

    if (!admin) {
      console.log('❌ Admin NOT found in DB. Creating...');
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(ADMIN_PASSWORD, salt);
      admin = await User.create({
        name: 'Admin User',
        email: ADMIN_EMAIL,
        password: hashed,
        role: 'admin',
        status: 'active'
      });
      console.log('✅ Admin created!');
    } else {
      console.log(`✅ Admin found! Role: ${admin.role}, Status: ${admin.status}`);
      console.log('   Resetting password to match .env...');
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(ADMIN_PASSWORD, salt);

      await User.updateOne({ email: ADMIN_EMAIL }, { $set: { password: hashed, status: 'active', role: 'admin' } });
      console.log('✅ Password reset successfully!');
    }

    // Verify it works now
    const freshAdmin = await User.findOne({ email: ADMIN_EMAIL }).select('+password');
    const isMatch = await bcrypt.compare(ADMIN_PASSWORD, freshAdmin.password);
    console.log(`\n🔍 Verification: password "${ADMIN_PASSWORD}" matches stored hash? ${isMatch ? '✅ YES' : '❌ NO'}`);
    console.log(`   Admin email : ${freshAdmin.email}`);
    console.log(`   Admin role  : ${freshAdmin.role}`);
    console.log(`   Admin status: ${freshAdmin.status}`);

    if (isMatch) {
      console.log('\n🎉 Login should work now! Use:');
      console.log(`   Email   : ${ADMIN_EMAIL}`);
      console.log(`   Password: ${ADMIN_PASSWORD}`);
    } else {
      console.log('\n⚠️  Something is wrong with bcrypt - please check node version.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
};

run();
