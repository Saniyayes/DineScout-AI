const express = require("express");
const router = express.Router();
const Restaurant = require("../models/Restaurant");

// 1. Competitor Radar
router.get("/competitors", async (req, res) => {
  try {
    const { city, cuisine, restCost, restRating } = req.query;
    
    // Find top 5 competitors
    const query = {};
    if (city) query.city = new RegExp(city, "i");
    if (cuisine) query.cuisines = new RegExp(cuisine, "i");
    
    const competitors = await Restaurant.find(query)
      .sort({ rating: -1, votes: -1 })
      .limit(5);
      
    // AI Tips generation based on owner metrics vs competitors
    const avgCompCost = competitors.length > 0 ? (competitors.reduce((acc, c) => acc + (Number(c.cost) || 0), 0) / competitors.length) : 800;
    const avgCompRating = competitors.length > 0 ? (competitors.reduce((acc, c) => acc + (Number(c.rating) || 0), 0) / competitors.length) : 4.0;
    
    const ownerCost = Number(restCost) || 800;
    const ownerRating = Number(restRating) || 4.2;
    
    const tips = [];
    
    if (ownerCost > avgCompCost) {
      tips.push(`Your price (₹${ownerCost}) is higher than the market average (₹${avgCompCost.toFixed(0)}). Ensure you emphasize premium quality and ambiance.`);
    } else {
      tips.push(`Your price (₹${ownerCost}) is competitive! Use this to attract budget-conscious diners away from top players.`);
    }
    
    if (ownerRating < avgCompRating) {
      tips.push(`Your rating (${ownerRating}★) is below the market leaders (${avgCompRating.toFixed(1)}★). Focus on immediate service improvements.`);
    } else {
      tips.push(`Great job! Your rating (${ownerRating}★) matches or beats top competitors. Leverage this in your marketing.`);
    }
    
    tips.push("Run a special weekend discount to capture footfall from nearby competitors during peak hours.");

    res.json({ competitors, tips });
  } catch (err) {
    console.error("Advisor Competitors Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// 2. Review Sentiment Analyzer
router.get("/sentiment", async (req, res) => {
  try {
    const { city, cuisine, restName } = req.query;
    
    // Mocking AI sentiment data tailored to the market
    const sentiment = {
      positive: Math.floor(Math.random() * 20) + 60, // 60-80%
      negative: Math.floor(Math.random() * 10) + 5,  // 5-15%
    };
    sentiment.neutral = 100 - sentiment.positive - sentiment.negative;
    
    const categories = {
      food: Math.floor(Math.random() * 20) + 75,
      service: Math.floor(Math.random() * 20) + 65,
      price: Math.floor(Math.random() * 20) + 60,
      ambiance: Math.floor(Math.random() * 20) + 70
    };
    
    const strengths = [
      `Diners in ${city || 'this area'} love authentic ${cuisine || 'local'} flavors.`,
      "Generous portion sizes are highly praised.",
      "Fast service during lunch hours is a major plus."
    ];
    
    const complaints = [
      "Inconsistent food temperatures during delivery.",
      "High pricing compared to neighboring areas.",
      "Lack of adequate parking spaces."
    ];
    
    if (restName) {
      const Review = require("../models/Review");
      const userReviews = await Review.find({ restaurantName: new RegExp(restName, 'i') });
      if (userReviews.length > 0) {
        let totalRating = 0;
        userReviews.forEach(r => {
          totalRating += r.rating;
          if (r.rating >= 4) {
             strengths.push(`User Review: "${r.text.substring(0, 50)}..."`);
          } else if (r.rating <= 2) {
             complaints.push(`User Review: "${r.text.substring(0, 50)}..."`);
          }
        });
        const avgRating = totalRating / userReviews.length;
        if (avgRating > 4) sentiment.positive = Math.min(100, sentiment.positive + 10);
        if (avgRating < 2.5) sentiment.negative = Math.min(100, sentiment.negative + 10);
        sentiment.neutral = 100 - sentiment.positive - sentiment.negative;
      }
    }

    res.json({ sentiment, categories, strengths, complaints });
  } catch (err) {
    console.error("Advisor Sentiment Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// 3. Revenue & Footfall Predictor
router.post("/predict", (req, res) => {
  try {
    const { city, cuisine, cost, capacity } = req.body;
    
    const safeCost = Number(cost) || 800;
    const safeCap = Number(capacity) || 50;
    
    // Simple heuristic calculation
    const dailyTurns = 2.5; // Average table turns
    const daysOpen = 30;
    const fillRate = 0.65; // 65% full on average
    
    const monthlyCustomers = Math.floor(safeCap * dailyTurns * daysOpen * fillRate);
    const avgSpendPerCustomer = safeCost / 2;
    const estRevenue = monthlyCustomers * avgSpendPerCustomer;
    
    const revenueRange = [estRevenue * 0.8, estRevenue * 1.2];
    
    // Generate 6 month trend
    const trend = [];
    let currentRev = revenueRange[0];
    for (let i=0; i<6; i++) {
      trend.push(Math.round(currentRev));
      currentRev *= (1 + (Math.random() * 0.1)); // 0-10% growth
    }
    
    let risk = "Medium";
    let breakEven = "8-12 months";
    let healthScore = 75 + Math.floor(Math.random() * 20); // 75-94
    
    if (safeCost > 1500 && safeCap < 30) {
      risk = "High";
      breakEven = "14-18 months";
      healthScore -= 15;
    } else if (safeCost < 500 && safeCap > 80) {
      risk = "Low";
      breakEven = "6-9 months";
      healthScore += 5;
    }
    
    res.json({
      monthlyCustomers,
      revenueRange,
      trend,
      risk,
      breakEven,
      healthScore: Math.min(100, healthScore)
    });
  } catch (err) {
    console.error("Advisor Predict Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;
