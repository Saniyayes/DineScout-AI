const mongoose = require("mongoose");
require("dotenv").config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/dinescout";

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return mongoose.connection;
  try {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB Connected ✅");
    return mongoose.connection;
  } catch (err) {
    console.error("MongoDB Connection Error ❌:", err);
    throw err;
  }
}

module.exports = connectDB;
