const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Restaurant = require("../models/Restaurant");
const Review = require("../models/Review");
const Notification = require("../models/Notification");
const UserNotification = require("../models/UserNotification");
const NotificationPreference = require("../models/NotificationPreference");
const spamScorer = require("../features/spamScorer");
const sse = require("../services/sse");

const router = express.Router();

// ================= ADMIN AUTH VERIFICATION MIDDLEWARE =================
async function verifyAdmin(req, res, next) {
  let token = req.headers["authorization"];

  if (!token) {
    return res.status(401).json({ msg: "Authentication token required" });
  }

  if (token.startsWith("Bearer ")) {
    token = token.slice(7).trim();
  }

  try {
    const secret = process.env.JWT_SECRET || "secret";
    const decoded = jwt.verify(token, secret);
    req.user = decoded;

    // Check DB record to guarantee active admin privileges
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(403).json({ msg: "User account not found" });
    }

    if (user.role !== "admin") {
      return res.status(403).json({ msg: "Access denied. Administrator privileges required." });
    }

    req.user.role = "admin";
    req.user.username = user.username;
    next();
  } catch (err) {
    return res.status(401).json({ msg: "Invalid or expired session token" });
  }
}

// ================= QUICK ADMIN SEED / SETUP =================
// Allows automatically bootstrapping an admin account (admin / admin123)
router.post("/setup", async (req, res) => {
  try {
    let adminUser = await User.findOne({ username: "admin" });
    if (!adminUser) {
      const hash = await bcrypt.hash("admin123", 10);
      adminUser = new User({
        username: "admin",
        email: "admin@dinescout.com",
        password: hash,
        role: "admin",
        verified: true
      });
      await adminUser.save();
      return res.json({
        msg: "Default Admin created successfully!",
        credentials: { username: "admin", password: "admin123" }
      });
    }

    // Ensure role is admin
    if (adminUser.role !== "admin" || !adminUser.verified) {
      adminUser.role = "admin";
      adminUser.verified = true;
      await adminUser.save();
    }

    res.json({
      msg: "Admin account is configured and ready.",
      credentials: { username: "admin", password: "admin123" }
    });
  } catch (err) {
    console.error("ADMIN SETUP ERROR:", err);
    res.status(500).json({ error: "Failed to setup admin account" });
  }
});

// ================= 1. PLATFORM OVERVIEW & STATS =================
router.get("/stats", verifyAdmin, async (req, res) => {
  try {
    // User counts
    const totalUsers = await User.countDocuments();
    const dinersCount = await User.countDocuments({ role: "user" });
    const ownersCount = await User.countDocuments({ role: "owner" });
    const adminsCount = await User.countDocuments({ role: "admin" });
    const unverifiedUsers = await User.countDocuments({ verified: false });

    // Restaurant counts & metrics
    const totalRestaurants = await Restaurant.countDocuments();
    const totalReviews = await Review.countDocuments();
    const totalNotifications = await Notification.countDocuments();

    // Top cities aggregation
    const cityAgg = await Restaurant.aggregate([
      { $match: { city: { $exists: true, $ne: "" } } },
      { $group: { _id: "$city", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ]);

    // Average cost and rating
    const avgMetrics = await Restaurant.aggregate([
      {
        $group: {
          _id: null,
          avgRating: { $avg: "$rating" },
          avgCost: { $avg: "$cost" }
        }
      }
    ]);

    const avgRating = avgMetrics.length && avgMetrics[0].avgRating ? Number(avgMetrics[0].avgRating.toFixed(2)) : 3.8;
    const avgCost = avgMetrics.length && avgMetrics[0].avgCost ? Math.round(avgMetrics[0].avgCost) : 650;

    // Rating distribution
    const ratingDist = {
      excellent: await Restaurant.countDocuments({ rating: { $gte: 4.5 } }),
      veryGood: await Restaurant.countDocuments({ rating: { $gte: 4.0, $lt: 4.5 } }),
      good: await Restaurant.countDocuments({ rating: { $gte: 3.5, $lt: 4.0 } }),
      average: await Restaurant.countDocuments({ rating: { $lt: 3.5 } })
    };

    // Recent 5 users
    const recentUsers = await User.find({}, "-password")
      .sort({ _id: -1 })
      .limit(5);

    // Recent 5 reviews
    const recentReviews = await Review.find({})
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      summary: {
        totalUsers,
        dinersCount,
        ownersCount,
        adminsCount,
        unverifiedUsers,
        totalRestaurants,
        totalReviews,
        totalNotifications,
        avgRating,
        avgCost
      },
      cityDistribution: cityAgg.map(c => ({ city: c._id, count: c.count })),
      ratingDistribution: ratingDist,
      recentUsers,
      recentReviews
    });
  } catch (err) {
    console.error("ADMIN STATS ERROR:", err);
    res.status(500).json({ error: "Failed to load platform statistics" });
  }
});

// ================= 2. USER MANAGEMENT =================
// List users with search, role filter, and pagination
router.get("/users", verifyAdmin, async (req, res) => {
  try {
    const { search, role, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { username: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } }
      ];
    }

    if (role && ["user", "owner", "admin"].includes(role)) {
      filter.role = role;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await User.countDocuments(filter);
    const users = await User.find(filter, "-password")
      .sort({ _id: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      users,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    console.error("ADMIN USERS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Create new user directly from Admin
router.post("/users", verifyAdmin, async (req, res) => {
  try {
    const { username, email, password, role = "user", verified = true } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ msg: "Username, email, and password required" });
    }

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    const existing = await User.findOne({
      $or: [{ username: cleanUsername }, { email: cleanEmail }]
    });

    if (existing) {
      return res.status(400).json({ msg: "User with this username or email already exists" });
    }

    const hash = await bcrypt.hash(password, 10);
    const newUser = new User({
      username: cleanUsername,
      email: cleanEmail,
      password: hash,
      role: ["user", "owner", "admin"].includes(role) ? role : "user",
      verified: Boolean(verified)
    });

    await newUser.save();
    res.json({ msg: "User created successfully", user: { id: newUser._id, username: newUser.username, role: newUser.role } });
  } catch (err) {
    console.error("ADMIN CREATE USER ERROR:", err);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// Update user role
router.put("/users/:id/role", verifyAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!["user", "owner", "admin"].includes(role)) {
      return res.status(400).json({ msg: "Invalid role specified" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    user.role = role;
    await user.save();
    res.json({ msg: `Role for ${user.username} updated to ${role}`, user });
  } catch (err) {
    console.error("ADMIN UPDATE ROLE ERROR:", err);
    res.status(500).json({ error: "Failed to update user role" });
  }
});

// Toggle verification status
router.put("/users/:id/status", verifyAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    user.verified = req.body.verified !== undefined ? Boolean(req.body.verified) : !user.verified;
    await user.save();
    res.json({ msg: `User verification updated to ${user.verified}`, user });
  } catch (err) {
    console.error("ADMIN UPDATE STATUS ERROR:", err);
    res.status(500).json({ error: "Failed to toggle status" });
  }
});

// Delete user
router.delete("/users/:id", verifyAdmin, async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ msg: "Cannot delete your own active admin account" });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    // Clean up notifications / preferences
    await UserNotification.deleteMany({ userId: req.params.id });
    await NotificationPreference.deleteMany({ userId: req.params.id });

    res.json({ msg: `User ${user.username} deleted successfully` });
  } catch (err) {
    console.error("ADMIN DELETE USER ERROR:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// ================= 3. RESTAURANT MANAGEMENT =================
// List restaurants with search, city filter, pagination
router.get("/restaurants", verifyAdmin, async (req, res) => {
  try {
    const { search, city, minRating, page = 1, limit = 15 } = req.query;
    const filter = {};

    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { cuisines: { $regex: q, $options: "i" } },
        { locality: { $regex: q, $options: "i" } }
      ];
    }

    if (city && city.trim() && city !== "All") {
      filter.city = { $regex: new RegExp("^" + city.trim() + "$", "i") };
    }

    if (minRating) {
      filter.rating = { $gte: parseFloat(minRating) };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Restaurant.countDocuments(filter);
    const restaurants = await Restaurant.find(filter)
      .sort({ rating: -1, votes: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get list of unique cities for filtering
    const cityList = await Restaurant.distinct("city");

    res.json({
      restaurants,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      cities: cityList.filter(Boolean).sort()
    });
  } catch (err) {
    console.error("ADMIN RESTAURANTS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch restaurants" });
  }
});

// Get single restaurant detail
router.get("/restaurants/:id", verifyAdmin, async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }
    res.json(restaurant);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch restaurant" });
  }
});

// Create new restaurant
router.post("/restaurants", verifyAdmin, async (req, res) => {
  try {
    const {
      name,
      cuisines,
      rating = 3.5,
      cost = 500,
      city = "Bangalore",
      locality = "",
      address = "",
      latitude = 12.9716,
      longitude = 77.5946,
      votes = 10,
      valueBadge = "Good Value 👍"
    } = req.body;

    if (!name) {
      return res.status(400).json({ msg: "Restaurant name is required" });
    }

    const newRest = new Restaurant({
      name: name.trim(),
      cuisines: cuisines || "Multi-Cuisine",
      rating: parseFloat(rating) || 3.5,
      cost: parseInt(cost) || 500,
      city: city.trim(),
      locality: locality.trim(),
      address: address.trim(),
      latitude: parseFloat(latitude) || 12.9716,
      longitude: parseFloat(longitude) || 77.5946,
      votes: parseInt(votes) || 10,
      valueBadge,
      valueScore: 7.0,
      reviewConfidenceScore: 85,
      reviewConfidenceLevel: "High",
      spamFlags: [],
      moodTags: ["popular", "casual dining"],
      reviews: [],
      dishes: []
    });

    await newRest.save();
    res.json({ msg: "Restaurant created successfully", restaurant: newRest });
  } catch (err) {
    console.error("ADMIN CREATE RESTAURANT ERROR:", err);
    res.status(500).json({ error: "Failed to create restaurant" });
  }
});

// Update restaurant
router.put("/restaurants/:id", verifyAdmin, async (req, res) => {
  try {
    const updateData = req.body;
    const updated = await Restaurant.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!updated) {
      return res.status(404).json({ error: "Restaurant not found" });
    }
    res.json({ msg: "Restaurant updated successfully", restaurant: updated });
  } catch (err) {
    console.error("ADMIN UPDATE RESTAURANT ERROR:", err);
    res.status(500).json({ error: "Failed to update restaurant" });
  }
});

// Delete restaurant
router.delete("/restaurants/:id", verifyAdmin, async (req, res) => {
  try {
    const r = await Restaurant.findByIdAndDelete(req.params.id);
    if (!r) {
      return res.status(404).json({ error: "Restaurant not found" });
    }
    // Also remove from reviews
    await Review.deleteMany({ restaurantId: req.params.id });
    res.json({ msg: `Restaurant "${r.name}" deleted successfully` });
  } catch (err) {
    console.error("ADMIN DELETE RESTAURANT ERROR:", err);
    res.status(500).json({ error: "Failed to delete restaurant" });
  }
});

// Run AI Review Authenticity / Spam Audit
router.post("/restaurants/:id/audit", verifyAdmin, async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    const analysis = spamScorer.analyzeReviewAuthenticity(restaurant.reviews || []);
    restaurant.reviewConfidenceScore = analysis.score;
    restaurant.reviewConfidenceLevel = analysis.level;
    restaurant.spamFlags = analysis.flags;
    await restaurant.save();

    res.json({
      msg: "Authenticity audit completed",
      confidenceScore: analysis.score,
      confidenceLevel: analysis.level,
      spamFlags: analysis.flags,
      reviewsCount: (restaurant.reviews || []).length
    });
  } catch (err) {
    console.error("ADMIN AUDIT ERROR:", err);
    res.status(500).json({ error: "Failed to run audit" });
  }
});

// ================= 4. REVIEW MODERATION =================
// List reviews
router.get("/reviews", verifyAdmin, async (req, res) => {
  try {
    const { search, rating, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { restaurantName: { $regex: q, $options: "i" } },
        { userName: { $regex: q, $options: "i" } },
        { text: { $regex: q, $options: "i" } }
      ];
    }

    if (rating) {
      filter.rating = parseInt(rating);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Review.countDocuments(filter);
    const reviews = await Review.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      reviews,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    console.error("ADMIN REVIEWS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// Delete inappropriate or spam review
router.delete("/reviews/:id", verifyAdmin, async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    // Remove from restaurant embedded reviews if present
    await Restaurant.findByIdAndUpdate(review.restaurantId, {
      $pull: {
        reviews: {
          user: review.userName,
          text: review.text
        }
      }
    });

    res.json({ msg: "Review removed successfully from the platform" });
  } catch (err) {
    console.error("ADMIN DELETE REVIEW ERROR:", err);
    res.status(500).json({ error: "Failed to delete review" });
  }
});

// ================= 5. PLATFORM BROADCASTS & NOTIFICATIONS =================
// List all platform notifications
router.get("/notifications", verifyAdmin, async (req, res) => {
  try {
    const notifications = await Notification.find({})
      .populate("ownerId", "username email role")
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(notifications);
  } catch (err) {
    console.error("ADMIN NOTIFICATIONS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// Admin sends platform-wide broadcast
router.post("/broadcast", verifyAdmin, async (req, res) => {
  try {
    const { title, message, type = "Announcement", targetAudience = "All" } = req.body;

    if (!title || !message) {
      return res.status(400).json({ msg: "Title and message are required for broadcast" });
    }

    const notification = new Notification({
      ownerId: req.user.id,
      title: `[System Broadcast] ${title}`,
      message,
      type: ["Offer", "Event", "New Menu", "Announcement"].includes(type) ? type : "Announcement",
      audienceType: "All",
      status: "Sent"
    });

    await notification.save();

    // Determine target recipient users
    let query = {};
    if (targetAudience === "Diners") query.role = "user";
    else if (targetAudience === "Owners") query.role = "owner";

    const targetUsers = await User.find(query).select("_id");
    const userIds = targetUsers.map(u => u._id);

    const userNotifs = userIds.map(uid => ({
      userId: uid,
      notificationId: notification._id
    }));

    if (userNotifs.length > 0) {
      await UserNotification.insertMany(userNotifs);
    }

    notification.stats.delivered = userIds.length;
    await notification.save();

    // Push live via SSE
    if (typeof sse.broadcast === "function") {
      sse.broadcast({
        _id: notification._id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        createdAt: notification.createdAt
      });
    } else if (typeof sse.sendNotificationToMultiple === "function") {
      sse.sendNotificationToMultiple(userIds, {
        _id: notification._id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        createdAt: notification.createdAt
      });
    }

    res.json({
      msg: `Broadcast dispatched successfully to ${userIds.length} users!`,
      notification
    });
  } catch (err) {
    console.error("ADMIN BROADCAST ERROR:", err);
    res.status(500).json({ error: "Failed to dispatch platform broadcast" });
  }
});

// Delete notification
router.delete("/notifications/:id", verifyAdmin, async (req, res) => {
  try {
    const notif = await Notification.findByIdAndDelete(req.params.id);
    if (!notif) {
      return res.status(404).json({ error: "Notification not found" });
    }

    await UserNotification.deleteMany({ notificationId: req.params.id });
    res.json({ msg: "Notification revoked and deleted" });
  } catch (err) {
    console.error("ADMIN DELETE NOTIF ERROR:", err);
    res.status(500).json({ error: "Failed to delete notification" });
  }
});

module.exports = router;
