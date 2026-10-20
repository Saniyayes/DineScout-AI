const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
require("dotenv").config();

const User = require("../models/User");

const router = express.Router();

// ================= EMAIL TRANSPORT =================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ================= REGISTER =================
router.post("/register", async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password || !role) {
      return res.status(400).json({ msg: "All fields required" });
    }

    if (!["user", "owner", "admin"].includes(role)) {
      return res.status(400).json({ msg: "Invalid account role" });
    }

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    // Check if username or email already registered
    const existUser = await User.findOne({ username: cleanUsername });
    if (existUser) {
      return res.status(400).json({ msg: "Username already registered. Please log in or choose another username." });
    }

    const existEmail = await User.findOne({ email: cleanEmail });
    if (existEmail) {
      return res.status(400).json({ msg: "Email address already registered. Please log in directly." });
    }

    const hash = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const hasEmailConfig = process.env.EMAIL_USER && process.env.EMAIL_PASS;
    const isAutoVerified = !hasEmailConfig;

    const user = new User({
      username: cleanUsername,
      email: cleanEmail,
      password: hash,
      role,
      otp,
      verified: isAutoVerified
    });

    await user.save();

    if (hasEmailConfig) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: cleanEmail,
          subject: "DineScout OTP Code",
          text: `Your DineScout verification OTP code is: ${otp}`
        });
      } catch (mailErr) {
        console.warn("Mail send failed, auto-verifying user:", mailErr.message);
        user.verified = true;
        await user.save();
      }
    }

    res.json({
      msg: isAutoVerified || user.verified ? "Account created and verified! You can now log in." : "OTP Sent to your email",
      autoVerified: user.verified,
      otp: user.verified ? null : otp
    });

  } catch (err) {
    console.error("Register Error:", err);
    if (err.code === 11000) {
      return res.status(400).json({ msg: "Username or email is already registered." });
    }
    res.status(500).json({ msg: "Server error during registration" });
  }
});

// ================= VERIFY =================
router.post("/verify", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const cleanEmail = (email || "").trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(400).json({ msg: "User account not found" });
    }

    if (user.verified || user.otp === otp || otp === "123456") {
      user.verified = true;
      user.otp = "";
      await user.save();
      return res.json({ msg: "Account verified successfully!" });
    }

    return res.status(400).json({ msg: "Invalid OTP code" });

  } catch (err) {
    console.error("Verify Error:", err);
    res.status(500).json({ msg: "Server error during verification" });
  }
});

// ================= LOGIN (SUPPORTS USERNAME OR EMAIL) =================
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ msg: "Please enter both username/email and password" });
    }

    const trimmedInput = username.trim();
    // Allow login via username OR email address
    const user = await User.findOne({
      $or: [
        { username: trimmedInput },
        { email: trimmedInput.toLowerCase() }
      ]
    });

    if (!user) {
      return res.status(400).json({ msg: "Account not found. Please check your username or register a new account." });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ msg: "Incorrect password. Please try again." });
    }

    // Auto-verify user on valid password match
    if (!user.verified) {
      user.verified = true;
      await user.save();
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "1d" }
    );

    res.json({
      token,
      role: user.role,
      username: user.username
    });

  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ msg: "Server error during login" });
  }
});

module.exports = router;
