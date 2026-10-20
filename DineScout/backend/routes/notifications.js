const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const UserNotification = require("../models/UserNotification");
const NotificationPreference = require("../models/NotificationPreference");
const User = require("../models/User");
const sse = require("../services/sse");

const router = express.Router();

function verifyToken(req, res, next) {
  let token = req.headers["authorization"];
  if (!token) return res.status(401).json({ msg: "No token" });
  if (token.startsWith("Bearer ")) token = token.slice(7).trim();
  try {
    const secret = process.env.JWT_SECRET || "secret";
    req.user = jwt.verify(token, secret);
    next();
  } catch {
    return res.status(401).json({ msg: "Invalid token" });
  }
}

async function verifyOwner(req, res, next) {
  if (req.user.role === "owner" || req.user.role === "admin") {
    return next();
  }
  try {
    // Check DB in case role was updated after token was issued
    const user = await User.findById(req.user.id);
    if (user && (user.role === "owner" || user.role === "admin")) {
      req.user.role = user.role;
      return next();
    }
  } catch(e) {
    console.error(e);
  }
  console.log(`[Auth] Denied owner access to user ${req.user.id} (role: ${req.user.role})`);
  return res.status(403).json({ msg: "Owner or Admin access required" });
}

// Owner creates a notification
router.post("/", verifyToken, verifyOwner, async (req, res) => {
  try {
    const { title, message, type, audienceType, audienceRadius, expiresAt, restaurantName } = req.body;
    
    const defaultExpiresAt = type === "Offer" ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null;

    // Create the notification
    const notification = new Notification({
      ownerId: req.user.id,
      title,
      message,
      type,
      audienceType,
      audienceRadius,
      expiresAt: expiresAt ? new Date(expiresAt) : defaultExpiresAt,
      status: "Sent"
    });
    await notification.save();

    let users = [];
    if (audienceType === 'Saved') {
      const Favorite = require("../models/Favorite");
      let favQuery = {};
      if (restaurantName) {
        favQuery = { restaurantName: new RegExp(restaurantName, "i") };
      }
      const favs = await Favorite.find(favQuery);
      const favUserIds = favs.map(f => f.userId);
      users = await User.find({ _id: { $in: favUserIds } }).select('_id');
      if (users.length === 0) {
        const allFavs = await Favorite.find({}).limit(50);
        users = await User.find({ _id: { $in: allFavs.map(f => f.userId) } }).select('_id');
      }
      if (users.length === 0) {
        users = await User.find({}).select('_id');
      }
    } else {
      // For demo/testing, send to ALL users in the system if not Saved
      users = await User.find({}).select('_id');
    }
    const userIds = users.map(u => u._id);

    // Filter by preferences
    const preferences = await NotificationPreference.find({ userId: { $in: userIds } });
    const prefMap = new Map(preferences.map(p => [p.userId.toString(), p]));

    const eligibleUsers = userIds.filter(id => {
      const p = prefMap.get(id.toString());
      if (!p) return true;
      if (p.mutedTypes && p.mutedTypes.includes(type)) return false;
      if (p.mutedOwners && p.mutedOwners.includes(req.user.id)) return false;
      return true;
    });

    const userNotifs = eligibleUsers.map(id => ({
      userId: id,
      notificationId: notification._id
    }));
    await UserNotification.insertMany(userNotifs);

    notification.stats.delivered = eligibleUsers.length;
    await notification.save();

    // Push via SSE
    const payload = {
      _id: notification._id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      createdAt: notification.createdAt
    };
    sse.sendNotificationToMultiple(eligibleUsers, payload);

    res.json(notification);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Owner gets their sent notifications
router.get("/owner", verifyToken, verifyOwner, async (req, res) => {
  try {
    const query = req.user.role === "admin" ? {} : { ownerId: req.user.id };
    const notifs = await Notification.find(query).sort({ createdAt: -1 });
    res.json(notifs);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// User gets their inbox
router.get("/", verifyToken, async (req, res) => {
  try {
    const userNotifs = await UserNotification.find({ userId: req.user.id })
      .populate("notificationId")
      .sort({ createdAt: -1 });
    
    const results = userNotifs.map(un => ({
      _id: un._id,
      notification: un.notificationId,
      isRead: un.isRead,
      createdAt: un.createdAt
    }));
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// User marks one as read
router.patch("/:id/read", verifyToken, async (req, res) => {
  try {
    const un = await UserNotification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { isRead: true, readAt: new Date() }
    );
    if (un && !un.isRead) {
      await Notification.findByIdAndUpdate(un.notificationId, { $inc: { 'stats.read': 1 } });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// User marks all as read
router.patch("/read-all", verifyToken, async (req, res) => {
  try {
    const unread = await UserNotification.find({ userId: req.user.id, isRead: false });
    const notifIds = unread.map(u => u.notificationId);
    
    await UserNotification.updateMany({ userId: req.user.id, isRead: false }, { isRead: true, readAt: new Date() });
    
    // Update stats for all
    for (const nid of notifIds) {
      await Notification.findByIdAndUpdate(nid, { $inc: { 'stats.read': 1 } });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// SSE endpoint
router.get("/stream", (req, res) => {
  let token = req.query.token;
  if (!token) return res.status(401).end();
  if (token.startsWith("Bearer ")) token = token.slice(7).trim();

  try {
    const secret = process.env.JWT_SECRET || "secret";
    const decoded = jwt.verify(token, secret);
    
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    sse.addClient(decoded.id, res);

    req.on("close", () => {
      sse.removeClient(decoded.id);
    });
  } catch {
    res.status(401).end();
  }
});

// --- AI Mock Endpoints ---
router.post("/ai/write", verifyToken, verifyOwner, (req, res) => {
  const idea = req.body.idea || "";
  res.json({
    variants: [
      { style: "Short", text: `🔥 ${idea} - Hurry in!` },
      { style: "Friendly", text: `Hey there! We wanted to let you know about this: ${idea}. See you soon!` },
      { style: "Urgent", text: `🚨 FLASH ALERT: ${idea}. Valid today only!` }
    ]
  });
});

router.post("/ai/predict", verifyToken, verifyOwner, (req, res) => {
  res.json({ suggestedTime: "18:00", reason: "Peak diner engagement based on recent trends." });
});

router.post("/ai/audience", verifyToken, verifyOwner, (req, res) => {
  res.json({ estimatedReach: Math.floor(Math.random() * 500) + 100, info: "Users matching your vibe and radius." });
});

router.post("/ai/score", verifyToken, verifyOwner, (req, res) => {
  const msg = req.body.message || "";
  const score = msg.length > 20 ? 85 : 45;
  res.json({ score, tip: score > 50 ? "Great hook!" : "Too short. Add an emoji or a sense of urgency." });
});

// User gets active offers
router.get("/offers", verifyToken, async (req, res) => {
  try {
    const userNotifs = await UserNotification.find({ userId: req.user.id }).populate("notificationId");
    const activeOffers = [];
    const now = new Date();
    
    for (let un of userNotifs) {
      if (un.notificationId && un.notificationId.type === "Offer") {
        if (!un.notificationId.expiresAt || new Date(un.notificationId.expiresAt) > now) {
          // Let's get the owner's restaurant name from User model if possible, or fallback
          const owner = await User.findById(un.notificationId.ownerId);
          // Wait, the owner user doesn't store their restaurant name in User model by default in this app?
          // We'll just pass the raw notification data, the frontend can display title and message.
          activeOffers.push({
            _id: un.notificationId._id,
            title: un.notificationId.title,
            message: un.notificationId.message,
            expiresAt: un.notificationId.expiresAt,
            createdAt: un.notificationId.createdAt
          });
        }
      }
    }
    
    res.json(activeOffers);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
