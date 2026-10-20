const express = require("express");
const jwt = require("jsonwebtoken");
const chatService = require("../chat/chatService");

const router = express.Router();

// ================= TOKEN VERIFY =================
function verifyToken(req, res, next) {
  let token = req.headers["authorization"];

  if (!token) {
    // Guest fallback session
    req.user = { role: req.body?.role || "user" };
    return next();
  }

  if (token.startsWith("Bearer ")) {
    token = token.slice(7).trim();
  }

  try {
    const secret = process.env.JWT_SECRET || "secret";
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch {
    // If token invalid, allow request with default guest role
    req.user = { role: req.body?.role || "user" };
    next();
  }
}

// ================= POST /api/chat =================
router.post("/", verifyToken, async (req, res) => {
  try {
    const { message, sessionId, role, lat, lon, city } = req.body;

    if (!message || message.trim() === "") {
      return res.status(400).json({ error: "Message content is required" });
    }

    const effectiveSessionId = sessionId || req.headers["x-session-id"] || "default-session";
    const userRole = req.user?.role || role || "user";

    const response = await chatService.processChatMessage(effectiveSessionId, message, userRole, { lat, lon, city });
    res.json(response);

  } catch (err) {
    console.error("CHAT ROUTE ERROR:", err);
    res.status(500).json({
      reply: "Sorry, I encountered an issue processing your query. Please try again!",
      restaurants: null,
      quickReplies: ["Try again", "Search cafes", "Help"]
    });
  }
});

module.exports = router;
