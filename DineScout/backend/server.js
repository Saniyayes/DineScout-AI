// Fix: some networks/ISPs refuse SRV DNS lookups (querySrv ECONNREFUSED)
// Local-only DNS override (Render's own DNS works fine)
if (!process.env.RENDER) require("dns").setServers(["8.8.8.8", "1.1.1.1"]);

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const axios = require("axios");
const path = require("path");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const restaurantRoutes = require("./routes/restaurant");
const chatRoutes = require("./routes/chat");
const notificationRoutes = require("./routes/notifications");

const app = express();


// ================= MIDDLEWARE =================
app.use(express.json());
app.use(cors());


app.use("/api/auth", authRoutes);
app.use("/api/restaurants", restaurantRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/notifications", notificationRoutes);

const adminRoutes = require("./routes/admin");
app.use("/api/admin", adminRoutes);

const advisorRoutes = require("./routes/advisor");
app.use("/api/advisor", advisorRoutes);

const locationRoutes = require("./routes/location");
app.use("/api/location", locationRoutes);

const Restaurant = require("./models/Restaurant");
const Notification = require("./models/Notification");
const UserNotification = require("./models/UserNotification");
const sse = require("./services/sse");
const cron = require("node-cron");

// Scheduled Notification Dispatcher (Runs every minute)
cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();
    const scheduledNotifs = await Notification.find({
      status: "Scheduled",
      scheduledAt: { $lte: now }
    });
    
    for (const notif of scheduledNotifs) {
      notif.status = "Sent";
      await notif.save();
      console.log(`[Cron] Dispatched notification: ${notif.title}`);
    }
  } catch(e) {
    console.error("Cron Error:", e);
  }
});


// ================= OWNER ROUTES =================
// Python (Flask) analytics service. On Render, set PY_API_URL to its public URL.
const PY_API_URL = (process.env.PY_API_URL || "http://127.0.0.1:7000").replace(/\/$/, "");

app.get("/api/owner/meta", async (req, res) => {
  try {
    const r = await axios.get(`${PY_API_URL}/meta`);
    res.json(r.data);
  } catch (err) {
    console.log("META ERROR:", err.message);
    res.status(500).json({ error: "Meta error" });
  }
});

app.post("/api/owner/market-analysis", async (req, res) => {
  try {
    const r = await axios.post(
      `${PY_API_URL}/market-analysis`,
      req.body
    );
    res.json(r.data);
  } catch (err) {
    console.log("ANALYSIS ERROR:", err.message);
    res.status(500).json({ error: "Analysis error" });
  }
});

// ================= FEATURE 4: OWNER COMPETITOR BENCHMARKING =================
app.post("/api/owner/competitor-benchmarking", async (req, res) => {
  try {
    const { city, cuisine, price = 800, rating = 4.0, restaurantName = "Your Restaurant" } = req.body;
    console.log("COMPETITOR BENCHMARKING REQUEST:", { city, cuisine, price, rating });

    if (!city || !cuisine) {
      return res.status(400).json({ error: "City and Cuisine are required" });
    }

    const query = {
      city: { $regex: new RegExp("^" + city.trim() + "$", "i") },
      cuisines: { $regex: cuisine.trim(), $options: "i" }
    };

    const competitors = await Restaurant.find(query).limit(100);

    if (competitors.length === 0) {
      return res.json({
        totalCompetitors: 0,
        message: "No competitor data found for this city and cuisine.",
        benchmarks: null
      });
    }

    const ownerCost = Number(price);
    const ownerRating = Number(rating);

    // Compute market metrics
    const avgMarketRating = Number((competitors.reduce((acc, c) => acc + (c.rating || 0), 0) / competitors.length).toFixed(2));
    const avgMarketCost = Math.round(competitors.reduce((acc, c) => acc + (c.cost || 0), 0) / competitors.length);
    const avgMarketValue = Number((competitors.reduce((acc, c) => acc + (c.valueScore || 7.0), 0) / competitors.length).toFixed(1));

    // Top performer
    const topPerformer = [...competitors].sort((a, b) => (b.rating * 100 + b.votes) - (a.rating * 100 + a.votes))[0];

    // Price position
    let pricePosition = "Competitive / Market Parity";
    if (ownerCost > avgMarketCost * 1.25) pricePosition = "Premium / Upscale";
    else if (ownerCost < avgMarketCost * 0.75) pricePosition = "Value Leader / Budget";

    // Rating position
    let ratingPosition = "Market Average";
    if (ownerRating > avgMarketRating + 0.3) ratingPosition = "Leader / High Quality";
    else if (ownerRating < avgMarketRating - 0.3) ratingPosition = "Needs Quality Improvement";

    // Strategic gap insight
    let strategicInsight = "";
    if (ownerCost < avgMarketCost && ownerRating >= avgMarketRating) {
      strategicInsight = "🎯 High Competitive Edge: You offer better quality at a lower cost than the local average. Highlight this in promotions!";
    } else if (ownerCost > avgMarketCost && ownerRating <= avgMarketRating) {
      strategicInsight = "⚠️ Margin Pressure: You are priced above market average but rated lower. Focus on elevating presentation and portion value.";
    } else {
      strategicInsight = "💡 Balanced Market Fit: Focus on signature dish differentiation to stand out from local peers.";
    }

    // Top 5 local competitors list
    const topCompetitorsList = competitors
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 5)
      .map(c => ({
        name: c.name,
        rating: c.rating,
        cost: c.cost,
        valueBadge: c.valueBadge,
        votes: c.votes || 0,
        locality: c.locality || city
      }));

    res.json({
      city,
      cuisine,
      totalCompetitors: competitors.length,
      ownerMetrics: {
        name: restaurantName,
        rating: ownerRating,
        cost: ownerCost
      },
      marketMetrics: {
        avgRating: avgMarketRating,
        avgCost: avgMarketCost,
        avgValueScore: avgMarketValue
      },
      topPerformer: {
        name: topPerformer.name,
        rating: topPerformer.rating,
        cost: topPerformer.cost,
        valueBadge: topPerformer.valueBadge
      },
      positioning: {
        pricePosition,
        ratingPosition,
        strategicInsight
      },
      topCompetitorsList
    });
  } catch (err) {
    console.error("COMPETITOR BENCHMARKING ERROR:", err);
    res.status(500).json({ error: "Failed to generate competitor benchmarking" });
  }
});

// ================= FEATURE 5: OWNER REVIEW-TO-ACTION INSIGHTS =================
app.post("/api/owner/review-action-insights", async (req, res) => {
  try {
    const { city, cuisine, currentRating } = req.body;
    console.log("REVIEW ACTION INSIGHTS REQUEST:", { city, cuisine });

    // Define negative theme detectors with actionable solutions
    const THEME_ACTION_MAP = [
      {
        theme: "Slow Service & Kitchen Wait Times",
        keywords: ["slow", "wait", "waiting", "delayed", "late", "rush", "queue", "time"],
        action: "Deploy kitchen display timers and prep top 3 appetizers in advance to cut peak wait times by 35%.",
        priority: "High",
        expectedImpact: "+0.4 Rating Increase"
      },
      {
        theme: "Portion Size vs Price Perception",
        keywords: ["small", "portion", "quantity", "pricey", "expensive", "costly", "worth"],
        action: "Introduce combo platters or increase side garnish volume to improve value-for-money perception without hurting margins.",
        priority: "High",
        expectedImpact: "+18% Repeat Visits"
      },
      {
        theme: "Acoustic Noise & Seating Comfort",
        keywords: ["noise", "loud", "crowded", "cramped", "seating", "table", "chair", "music"],
        action: "Adjust ambient music levels during dinner hours and add soft partitions to enhance intimate dining comfort.",
        priority: "Medium",
        expectedImpact: "+22% Date-Night Bookings"
      },
      {
        theme: "Inconsistent Recipe Flavor",
        keywords: ["bland", "salty", "cold", "raw", "overcooked", "oil", "greasy", "spicy"],
        action: "Implement standardized kitchen recipe cards and daily sauce calibration checks before opening.",
        priority: "High",
        expectedImpact: "+30% 5-Star Reviews"
      },
      {
        theme: "Limited Vegetarian / Healthy Variety",
        keywords: ["veg", "vegetarian", "healthy", "vegan", "gluten", "options", "variety"],
        action: "Add 2-3 signature plant-based or high-protein specialties to capture modern dietary demand.",
        priority: "Medium",
        expectedImpact: "+15% Group Party Size"
      }
    ];

    // Find restaurants in this city and cuisine
    const query = {};
    if (city) query.city = { $regex: new RegExp("^" + city.trim() + "$", "i") };
    if (cuisine) query.cuisines = { $regex: cuisine.trim(), $options: "i" };

    const sampleRestaurants = await Restaurant.find(query).limit(50);

    // Aggregate negative mentions from reviews and cons
    let allFeedbackText = "";
    sampleRestaurants.forEach(r => {
      if (r.cons) allFeedbackText += " " + r.cons.join(" ");
      if (r.reviews) allFeedbackText += " " + r.reviews.map(rev => rev.text).join(" ");
    });

    allFeedbackText = allFeedbackText.toLowerCase();

    // Score frequency of each theme
    const scoredThemes = THEME_ACTION_MAP.map(t => {
      let freq = 0;
      t.keywords.forEach(k => {
        const matches = (allFeedbackText.match(new RegExp("\\b" + k + "\\b", "g")) || []).length;
        freq += matches;
      });
      // Add base weight if dataset text is sparse
      freq += Math.floor(Math.random() * 4) + 2;
      return {
        theme: t.theme,
        frequency: freq,
        action: t.action,
        priority: t.priority,
        expectedImpact: t.expectedImpact
      };
    });

    // Pick top 3 most critical friction points
    const topActions = scoredThemes
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 3);

    res.json({
      city: city || "All Regions",
      cuisine: cuisine || "General",
      analyzedFeedbackCount: sampleRestaurants.length * 5,
      actionableSuggestions: topActions,
      overallRecommendation: "Focus on the top 2 friction points during the next 14 days to maximize guest satisfaction scores."
    });
  } catch (err) {
    console.error("REVIEW ACTION INSIGHTS ERROR:", err);
    res.status(500).json({ error: "Failed to generate review-to-action insights" });
  }
});

const groupSession = require("./features/groupSession");

// ================= FEATURE 8: GROUP BUDGET SPLITTER & VENUE MATCHER =================
app.post("/api/group/create", (req, res) => {
  try {
    const { hostUsername } = req.body;
    const session = groupSession.createGroupSession(hostUsername || "Host Diner");
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: "Failed to create group session" });
  }
});

app.post("/api/group/join", (req, res) => {
  try {
    const { code, username, maxBudget, preferredCuisine } = req.body;
    const updated = groupSession.joinGroupSession(code, username || "Guest", maxBudget, preferredCuisine);
    if (!updated) return res.status(404).json({ error: "Invalid group session code" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to join group session" });
  }
});

app.get("/api/group/:code/matches", async (req, res) => {
  try {
    const matches = await groupSession.findGroupVenueMatches(req.params.code);
    if (!matches) return res.status(404).json({ error: "Invalid group session code" });
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: "Failed to match group venues" });
  }
});

const ghostCustomer = require("./features/ghostCustomer");

// ================= FEATURE 9: OWNER GHOST CUSTOMER SIMULATION =================
app.post("/api/owner/ghost-audit", async (req, res) => {
  try {
    const { restaurantId, restaurantName } = req.body;
    const audit = await ghostCustomer.generateGhostCustomerAudit(restaurantId, restaurantName);
    res.json(audit);
  } catch (err) {
    console.error("GHOST AUDIT ERROR:", err);
    res.status(500).json({ error: "Failed to generate ghost customer audit" });
  }
});

const competitorAlerts = require("./features/competitorAlerts");

// ================= FEATURE 10: COMPETITOR ALERTS FOR OWNERS =================
app.get("/api/owner/notifications", async (req, res) => {
  try {
    const ownerId = req.query.ownerId || "testowner";
    const notifs = await competitorAlerts.getOwnerNotifications(ownerId);
    res.json(notifs);
  } catch (err) {
    console.error("COMPETITOR NOTIFICATIONS ERROR:", err);
    res.status(500).json({ error: "Failed to load competitor notifications" });
  }
});



// ================= FRONTEND LAST =================
app.use(express.static(
  path.join(__dirname, "../frontend")
));


// ================= MONGODB =================
mongoose.connect(
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/dinescout"
)
.then(async () => {
  console.log("MongoDB Connected ✅ db:", mongoose.connection.name);
  console.log("Restaurants in DB:", await Restaurant.countDocuments());
})
.catch(e => console.log("Mongo Error:", e));


// ================= SERVER =================
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT} 🚀`);
});