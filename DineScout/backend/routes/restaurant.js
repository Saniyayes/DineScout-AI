const express = require("express");
const jwt = require("jsonwebtoken");

const router = express.Router();
const Restaurant = require("../models/Restaurant");
const spamScorer = require("../features/spamScorer");
const voiceReview = require("../features/voiceReview");
const priceSnapshotter = require("../features/priceSnapshotter");
const dishDna = require("../features/dishDna");
const trendDetector = require("../features/trendDetector");
const regretRadar = require("../features/regretRadar");
const loyaltyTracker = require("../features/loyaltyTracker");

// ================= TOKEN VERIFY =================
function verifyToken(req, res, next) {
  let token = req.headers["authorization"];

  if (!token) {
    return res.status(401).json({ msg: "No token" });
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
    return res.status(401).json({ msg: "Invalid token" });
  }
}

// ================= DISTANCE FUNCTION =================
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // KM
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Keyword dictionary for Mood/Occasion scoring
const MOOD_KEYWORDS = {
  romantic: {
    words: ["romantic", "date", "candlelight", "first date", "couple", "intimate", "wine", "anniversary"],
    cuisines: ["italian", "french", "continental", "desserts", "japanese", "european"],
    minRating: 3.8
  },
  quiet: {
    words: ["quiet", "peaceful", "calm", "work", "laptop", "study", "coffee", "cozy", "reading", "silent"],
    cuisines: ["cafe", "coffee", "bakery", "tea", "desserts"],
    maxCost: 1500
  },
  budget: {
    words: ["budget", "cheap", "pocket friendly", "affordable", "student", "quick", "bites", "economic"],
    cuisines: ["fast food", "street food", "snack", "south indian", "momos", "rolls"],
    maxCost: 600
  },
  party: {
    words: ["party", "drinks", "pub", "bar", "cocktails", "nightlife", "music", "dj", "late night", "beer", "lively"],
    cuisines: ["bar food", "finger food", "continental", "mexican", "american"],
    minRating: 3.5
  },
  family: {
    words: ["family", "kids", "children", "large group", "gathering", "celebration", "thali", "buffet"],
    cuisines: ["north indian", "south indian", "chinese", "mughlai", "biryani", "buffet"],
    minRating: 3.4
  },
  healthy: {
    words: ["healthy", "salad", "diet", "vegan", "vegetarian", "organic", "fresh", "keto", "fit"],
    cuisines: ["salad", "healthy food", "continental", "mediterranean", "juices"],
    minRating: 3.6
  },
  hotel: {
    words: ["hotel", "luxury", "stays", "fine dining", "resort", "lodging"],
    cuisines: ["luxury dining", "fine dining", "continental", "multi-cuisine"],
    minRating: 3.5
  }
};

// ================= FEATURE 1: MOOD/OCCASION-BASED SEARCH =================
router.get("/mood-search", verifyToken, async (req, res) => {
  try {
    const { query, lat, lon, budget } = req.query;
    console.log("MOOD SEARCH:", { query, lat, lon, budget });

    if (!query || query.trim() === "") {
      return res.status(400).json({ error: "Mood/occasion query is required" });
    }

    const qLower = query.toLowerCase();
    const queryTokens = qLower.split(/[\s,]+/);

    // Identify matching mood categories
    const matchedMoods = [];
    for (const [moodKey, config] of Object.entries(MOOD_KEYWORDS)) {
      const matchCount = config.words.filter(w => qLower.includes(w)).length;
      if (matchCount > 0) {
        matchedMoods.push({ moodKey, config, matchCount });
      }
    }

    // Build database query
    let mongoQuery = {};
    if (budget && Number(budget) > 0) {
      mongoQuery.cost = { $lte: Number(budget) };
    }

    // Location Bounding Box Filter (roughly 50km radius)
    if (lat && lon) {
      const latNum = Number(lat);
      const lonNum = Number(lon);
      mongoQuery.latitude = { $gte: latNum - 0.5, $lte: latNum + 0.5 };
      mongoQuery.longitude = { $gte: lonNum - 0.5, $lte: lonNum + 0.5 };
    }

    const candidates = await Restaurant.find(mongoQuery).limit(500);

    // Score candidates based on mood keywords, sentiment, tags, rating, and distance
    const scoredList = candidates.map(r => {
      let score = 0;
      const rName = (r.name || "").toLowerCase();
      const rCuisines = (r.cuisines || "").toLowerCase();
      const rTags = (r.moodTags || []).map(t => t.toLowerCase());

      // 1. Direct query token match in name, cuisines, and mood tags
      queryTokens.forEach(token => {
        if (token.length < 3) return;
        if (rName.includes(token)) score += 8;
        if (rCuisines.includes(token)) score += 6;
        if (rTags.some(t => t.includes(token))) score += 7;
      });

      // 2. Mood category match
      matchedMoods.forEach(({ config, matchCount }) => {
        // Tag overlap
        rTags.forEach(t => {
          if (config.words.some(w => t.includes(w))) score += 5 * matchCount;
        });

        // Cuisine affinity
        if (config.cuisines && config.cuisines.some(c => rCuisines.includes(c))) {
          score += 4 * matchCount;
        }

        // Min rating bonus
        if (config.minRating && r.rating >= config.minRating) {
          score += 3;
        }

        // Cost affinity
        if (config.maxCost && r.cost <= config.maxCost) {
          score += 4;
        }
      });

      // 3. Base rating & value score contribution
      score += (r.rating || 3.0) * 2;
      score += (r.valueScore || 7.0) * 0.5;

      // Distance calculation
      let distance = 9999;
      if (lat && lon && r.latitude && r.longitude) {
        distance = getDistance(Number(lat), Number(lon), r.latitude, r.longitude);
        // Proximity bonus for places within 10km
        if (distance < 5) score += 6;
        else if (distance < 15) score += 3;
      }

      return {
        id: r._id,
        name: r.name,
        cuisines: r.cuisines,
        rating: r.rating,
        cost: r.cost,
        latitude: r.latitude,
        longitude: r.longitude,
        city: r.city,
        address: r.address,
        locality: r.locality,
        votes: r.votes,
        valueScore: r.valueScore || 7.0,
        valueBadge: r.valueBadge || "Good Value 👍",
        moodTags: r.moodTags || [],
        pros: r.pros || [],
        cons: r.cons || [],
        photoUrl: r.photoUrl,
        distance: distance !== 9999 ? distance.toFixed(2) : "N/A",
        relevanceScore: Math.round(score * 10) / 10
      };
    });

    // Filter out low scores and sort by relevance score descending
    const results = scoredList
      .filter(item => item.relevanceScore > 5)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 20);

    const annotatedResults = results.map(item => ({
      ...item,
      regretWarning: regretRadar.evaluateMismatchWarnings(item, ["expensive", "spicy"]),
      loyaltyBadge: loyaltyTracker.calculateLoyaltyRate(item).badgeText
    }));

    res.json({
      query,
      detectedMoods: matchedMoods.map(m => m.moodKey),
      count: annotatedResults.length,
      results: annotatedResults
    });
  } catch (err) {
    console.error("MOOD SEARCH ERROR:", err);
    res.status(500).json({ error: "Mood search failed" });
  }
});

// ================= FEATURE 2: AI REVIEW SUMMARIZATION (PROS & CONS) =================
router.get("/:id/review-summary", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const restaurant = await Restaurant.findById(id);

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    // Dynamic keyword sentiment aggregation over reviews
    const pros = restaurant.pros && restaurant.pros.length > 0
      ? restaurant.pros
      : [
          `Known for delicious ${restaurant.cuisines.split(",")[0] || "specialties"}`,
          `Rated ${restaurant.rating}/5 by diners with ${restaurant.votes || 50}+ reviews`,
          `Value for money rating: ${restaurant.valueScore || 7.5}/10`
        ];

    const cons = restaurant.cons && restaurant.cons.length > 0
      ? restaurant.cons
      : [
          "Peak rush hours might have a short waiting time",
          "Advance table booking is advisable on weekends"
        ];

    // Compute sentiment breakdown
    const positiveScore = Math.min(95, Math.max(50, Math.round((restaurant.rating / 5) * 100)));
    const negativeScore = 100 - positiveScore;

    res.json({
      id: restaurant._id,
      name: restaurant.name,
      rating: restaurant.rating,
      votes: restaurant.votes,
      valueBadge: restaurant.valueBadge,
      valueScore: restaurant.valueScore,
      summary: {
        sentimentDistribution: {
          positive: `${positiveScore}%`,
          negative: `${negativeScore}%`
        },
        pros,
        cons,
        aiVerdict: restaurant.rating >= 4.0
          ? "Highly recommended for quality and taste."
          : restaurant.rating >= 3.0
          ? "Good casual option offering balanced value."
          : "Budget-friendly option for quick dining."
      },
      recentReviews: restaurant.reviews || []
    });
  } catch (err) {
    console.error("REVIEW SUMMARY ERROR:", err);
    res.status(500).json({ error: "Failed to generate review summary" });
  }
});

// ================= FEATURE 6: MENU / DISH RECOMMENDATIONS =================
router.get("/dishes/recommendations", async (req, res) => {
  try {
    const { cuisine, city, maxPrice } = req.query;
    console.log("DISH RECOMMENDATIONS QUERY:", { cuisine, city, maxPrice });

    const searchTerm = (cuisine || "").trim();

    let searchCity = city;
    if (searchCity && searchCity.toLowerCase() === "bengaluru") {
      searchCity = "Bangalore";
    }

    let filter = {};
    if (searchCity && searchCity.trim() !== "") {
      filter.city = { $regex: searchCity, $options: "i" };
    }
    if (searchTerm) {
      filter.$or = [
        { cuisines: { $regex: searchTerm, $options: "i" } },
        { "dishes.name": { $regex: searchTerm, $options: "i" } },
        { name: { $regex: searchTerm, $options: "i" } }
      ];
    }

    const restaurants = await Restaurant.find(filter).limit(100);
    const dishMap = new Map();

    restaurants.forEach(r => {
      const hasValidDishes = r.dishes && r.dishes.length > 0 && r.dishes.some(d => d.name && d.name.trim() !== "");
      const dishList = hasValidDishes ? r.dishes : dishDna.generateDefaultDishes(r.cuisines);

      dishList.forEach(d => {
        if (!d || !d.name) return;
        if (maxPrice && Number(maxPrice) > 0 && (d.price || 250) > Number(maxPrice)) {
          return;
        }

        // If specific search term, check if dish name or cuisine matches
        if (searchTerm) {
          const matchDish = d.name.toLowerCase().includes(searchTerm.toLowerCase());
          const matchCuisine = (r.cuisines || "").toLowerCase().includes(searchTerm.toLowerCase());
          const matchRest = (r.name || "").toLowerCase().includes(searchTerm.toLowerCase());
          if (!matchDish && !matchCuisine && !matchRest) return;
        }

        const key = d.name;
        if (!dishMap.has(key)) {
          dishMap.set(key, {
            dishName: d.name,
            category: d.category || "Specialty",
            avgPrice: d.price || r.cost || 250,
            avgRating: d.rating || r.rating || 4.2,
            isSignature: d.isSignature || false,
            cuisines: r.cuisines,
            topRestaurants: []
          });
        }

        const existing = dishMap.get(key);
        if (existing.topRestaurants.length < 3) {
          existing.topRestaurants.push({
            id: r._id,
            name: r.name,
            rating: r.rating,
            cost: r.cost,
            city: r.city,
            valueBadge: r.valueBadge || "Good Value 👍"
          });
        }
      });
    });

    const dishList = Array.from(dishMap.values())
      .sort((a, b) => (b.isSignature ? 1 : 0) - (a.isSignature ? 1 : 0) || b.avgRating - a.avgRating)
      .slice(0, 15);

    res.json({
      count: dishList.length,
      dishes: dishList
    });
  } catch (err) {
    console.error("DISH RECOMMENDATION ERROR:", err);
    res.status(500).json({ error: "Failed to fetch dish recommendations" });
  }
});

// ================= STANDARD SEARCH (WITH LOCATION & VALUE BADGES) =================
router.get("/search", verifyToken, async (req, res) => {
  try {
    const { cuisine, budget, lat, lon, sortMode } = req.query;
    console.log("STANDARD SEARCH:", cuisine, budget, lat, lon, sortMode);

    if (!lat || !lon) {
      return res.status(400).json({ error: "Location missing" });
    }

    const { searchNearby } = require("../services/restaurantService");
    const result = await searchNearby({
      lat,
      lon,
      cuisine,
      budget,
      limit: 20,
      sortMode: sortMode || (cuisine ? "distance" : "rating")
    });

    res.json(result);
  } catch (err) {
    console.log("SEARCH ERROR:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// ================= FEATURE 5: LOCAL FOOD TREND DETECTOR =================
router.get("/trends/locality", verifyToken, async (req, res) => {
  try {
    const city = req.query.city || "New Delhi";
    const trends = await trendDetector.detectLocalityTrends(city);
    res.json(trends);
  } catch (err) {
    console.error("LOCALITY TRENDS ERROR:", err);
    res.status(500).json({ error: "Failed to detect locality trends" });
  }
});

// ================= FEATURE 4: DISH DNA & FLAVOR PROFILE SEARCH =================
router.get("/dishes/flavor-search", verifyToken, async (req, res) => {
  try {
    const { flavor, maxPrice } = req.query;
    if (!flavor) {
      return res.status(400).json({ error: "Flavor profile query is required (e.g. spicy, creamy, tangy, smoky)" });
    }

    const targetFlavor = flavor.toLowerCase().trim();
    const limitPrice = maxPrice ? Number(maxPrice) : 9999;

    const restaurants = await Restaurant.find({}).limit(80);
    const matchingDishes = [];

    restaurants.forEach(r => {
      const dishList = (r.dishes && r.dishes.length > 0) ? r.dishes : dishDna.generateDefaultDishes(r.cuisines);
      dishList.forEach(d => {
        const tags = d.flavorTags && d.flavorTags.length > 0
          ? d.flavorTags
          : dishDna.extractFlavorTags(d.name + " " + (d.category || ""));

        if (tags.includes(targetFlavor) && (d.price || 250) <= limitPrice) {
          matchingDishes.push({
            dishName: d.name,
            category: d.category || "Specialty",
            price: d.price || r.cost || 250,
            rating: d.rating || r.rating || 4.0,
            flavorTags: tags,
            restaurantId: r._id,
            restaurantName: r.name,
            city: r.city || r.locality,
            locality: r.locality
          });
        }
      });
    });

    // Sort by rating then price
    matchingDishes.sort((a, b) => b.rating - a.rating);

    res.json({
      targetFlavor,
      count: matchingDishes.length,
      dishes: matchingDishes.slice(0, 15)
    });
  } catch (err) {
    console.error("FLAVOR SEARCH ERROR:", err);
    res.status(500).json({ error: "Failed to search dish flavor profiles" });
  }
});

router.get("/dishes/similar", verifyToken, async (req, res) => {
  try {
    const { dishName } = req.query;
    if (!dishName) {
      return res.status(400).json({ error: "Dish name parameter is required" });
    }

    const sourceTags = dishDna.extractFlavorTags(dishName);
    const restaurants = await Restaurant.find({}).limit(80);
    const similarDishes = [];

    restaurants.forEach(r => {
      (r.dishes || []).forEach(d => {
        if (d.name.toLowerCase() !== dishName.toLowerCase()) {
          const tags = d.flavorTags && d.flavorTags.length > 0
            ? d.flavorTags
            : dishDna.extractFlavorTags(d.name);

          const overlap = dishDna.calculateFlavorOverlap(sourceTags, tags);
          if (overlap > 0) {
            similarDishes.push({
              dishName: d.name,
              price: d.price || 250,
              rating: d.rating || r.rating,
              flavorTags: tags,
              similarityScore: overlap,
              restaurantName: r.name,
              city: r.city
            });
          }
        }
      });
    });

    similarDishes.sort((a, b) => b.similarityScore - a.similarityScore);

    res.json({
      queryDish: dishName,
      extractedFlavorTags: sourceTags,
      similarDishes: similarDishes.slice(0, 12)
    });
  } catch (err) {
    console.error("SIMILAR DISHES ERROR:", err);
    res.status(500).json({ error: "Failed to find similar dishes" });
  }
});

// ================= FEATURE 3: TIME-MACHINE PRICING TRENDS =================
router.get("/:id/trends", verifyToken, async (req, res) => {
  try {
    const trends = await priceSnapshotter.getRestaurantTrends(req.params.id);
    if (!trends) return res.status(404).json({ error: "Restaurant not found" });
    res.json(trends);
  } catch (err) {
    console.error("PRICING TRENDS ERROR:", err);
    res.status(500).json({ error: "Failed to load pricing trend data" });
  }
});

// ================= FEATURE 2: VOICE-NOTE REVIEW PARSING =================
router.post("/:id/voice-review", verifyToken, async (req, res) => {
  try {
    const { transcript, rating, username } = req.body;
    if (!transcript) {
      return res.status(400).json({ error: "Voice transcript text is required" });
    }

    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });

    const reviewObj = voiceReview.parseVoiceTranscript(
      transcript,
      rating,
      username || req.user?.username || "Voice Diner"
    );

    restaurant.reviews.unshift({
      user: reviewObj.user,
      rating: reviewObj.rating,
      text: reviewObj.text,
      date: reviewObj.date,
      isVoiceSourced: true,
      audioUrl: reviewObj.audioUrl
    });

    await restaurant.save();

    res.json({
      msg: "Voice review processed successfully",
      review: reviewObj,
      totalReviews: restaurant.reviews.length
    });
  } catch (err) {
    console.error("VOICE REVIEW ERROR:", err);
    res.status(500).json({ error: "Failed to process voice review" });
  }
});

// ================= FEATURE 1: REVIEW AUTHENTICITY / SPAM SCORE =================
router.get("/:id/authenticity", verifyToken, async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });

    const analysis = spamScorer.analyzeReviewAuthenticity(restaurant.reviews || []);
    
    // Update document fields
    restaurant.reviewConfidenceScore = analysis.score;
    restaurant.reviewConfidenceLevel = analysis.level;
    restaurant.spamFlags = analysis.flags;
    await restaurant.save();

    res.json({
      restaurantId: restaurant._id,
      name: restaurant.name,
      confidenceScore: analysis.score,
      confidenceLevel: analysis.level,
      spamFlags: analysis.flags,
      totalReviewsAnalyzed: (restaurant.reviews || []).length
    });
  } catch (err) {
    console.error("AUTHENTICITY SCORE ERROR:", err);
    res.status(500).json({ error: "Failed to evaluate review authenticity" });
  }
});

// Move GET /:id to bottom

const Favorite = require("../models/Favorite");
const Review = require("../models/Review");

// ================= FAVORITES ROUTES =================
router.get("/favorites", verifyToken, async (req, res) => {
  try {
    const favs = await Favorite.find({ userId: req.user.id });
    res.json(favs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch favorites" });
  }
});

router.post("/favorites", verifyToken, async (req, res) => {
  try {
    const { restaurantId, restaurantName, locality, city } = req.body;
    const existing = await Favorite.findOne({ userId: req.user.id, restaurantId });
    if (existing) return res.status(400).json({ msg: "Already saved" });

    const fav = new Favorite({ userId: req.user.id, restaurantId, restaurantName, locality, city });
    await fav.save();
    res.json(fav);
  } catch (err) {
    res.status(500).json({ error: "Failed to save favorite" });
  }
});

router.delete("/favorites/:id", verifyToken, async (req, res) => {
  try {
    await Favorite.findOneAndDelete({ userId: req.user.id, restaurantId: req.params.id });
    res.json({ msg: "Removed from favorites" });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove favorite" });
  }
});

// ================= USER REVIEWS ROUTES =================
router.post("/reviews", verifyToken, async (req, res) => {
  try {
    const { restaurantId, restaurantName, rating, text, tags } = req.body;
    if (!rating || !text) return res.status(400).json({ msg: "Rating and text are required" });
    
    // Check if user already reviewed
    const existing = await Review.findOne({ userId: req.user.id, restaurantId });
    if (existing) return res.status(400).json({ msg: "You have already reviewed this restaurant" });

    // Assuming we have username in token, else fallback
    const userName = req.user.username || "Anonymous";

    // Sanitize input (basic)
    const sanitizedText = text.replace(/<[^>]*>?/gm, "");

    const newReview = new Review({
      userId: req.user.id,
      userName,
      restaurantId,
      restaurantName,
      rating,
      text: sanitizedText,
      tags: tags || []
    });

    await newReview.save();
    
    // Also push to Restaurant document for easy UI display
    await Restaurant.findByIdAndUpdate(restaurantId, {
      $push: {
        reviews: {
          $each: [{
            user: userName,
            rating: rating,
            text: sanitizedText,
            date: new Date().toISOString()
          }],
          $position: 0
        }
      }
    });

    res.json(newReview);
  } catch (err) {
    res.status(500).json({ error: "Failed to post review" });
  }
});

router.get("/reviews/:restaurantId", verifyToken, async (req, res) => {
  try {
    const reviews = await Review.find({ restaurantId: req.params.restaurantId }).sort({ createdAt: -1 }).limit(10);
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// ================= RESTAURANT DETAIL =================
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const r = await Restaurant.findById(req.params.id);
    if (!r) return res.status(404).json({ error: "Restaurant not found" });
    
    // Calculate live authenticity score
    const authAnalysis = spamScorer.analyzeReviewAuthenticity(r.reviews || []);
    const docObj = r.toObject();
    docObj.reviewConfidenceScore = authAnalysis.score;
    docObj.reviewConfidenceLevel = authAnalysis.level;
    docObj.spamFlags = authAnalysis.flags;

    res.json(docObj);
  } catch (err) {
    res.status(500).json({ error: "Failed to get restaurant" });
  }
});

module.exports = router;
