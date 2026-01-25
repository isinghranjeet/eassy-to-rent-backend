const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    console.log("🔌 Attempting MongoDB connection...");

    const mongoURI = process.env.MONGO_URI; // ✅ CORRECT NAME

    if (!mongoURI) {
      console.error("❌ MONGO_URI is missing in environment variables");
      process.exit(1);
    }

    const conn = await mongoose.connect(mongoURI);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error.message);
    process.exit(1); // ⛔ crash app if DB fails
  }
};

module.exports = connectDB;
