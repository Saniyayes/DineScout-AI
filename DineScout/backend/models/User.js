const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({

  username: { type: String, unique: true },
  email: { type: String, unique: true },
  password: String,

  role: {
    type: String,
    enum: ["user", "owner", "admin"],
    default: "user"
  },

  otp: String,
  verified: { type: Boolean, default: false }

});

module.exports = mongoose.model("User", userSchema);
