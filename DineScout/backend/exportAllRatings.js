const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Restaurant = require("./models/Restaurant");

async function generateFullReport() {
  await mongoose.connect("mongodb://127.0.0.1:27017/dinescout");

  const totalCount = await Restaurant.countDocuments();

  // All Cities stats
  const cityStats = await Restaurant.aggregate([
    {
      $group: {
        _id: "$city",
        avgRating: { $avg: "$rating" },
        avgCost: { $avg: "$cost" },
        totalRestaurants: { $sum: 1 },
        totalVotes: { $sum: "$votes" }
      }
    },
    { $sort: { totalRestaurants: -1 } }
  ]);

  // All Cuisines stats
  const cuisineStats = await Restaurant.aggregate([
    {
      $project: {
        cuisinesArray: { $split: [{ $ifNull: ["$cuisines", "Other"] }, ", "] },
        rating: "$rating",
        cost: "$cost"
      }
    },
    { $unwind: "$cuisinesArray" },
    {
      $group: {
        _id: "$cuisinesArray",
        avgRating: { $avg: "$rating" },
        avgCost: { $avg: "$cost" },
        totalRestaurants: { $sum: 1 }
      }
    },
    { $sort: { totalRestaurants: -1 } }
  ]);

  // Top 100 Restaurants by Votes & Rating
  const topRestaurants = await Restaurant.find({})
    .sort({ rating: -1, votes: -1 })
    .limit(100);

  // Bottom / Critical Risk Restaurants
  const criticalRiskRestaurants = await Restaurant.find({ rating: { $gt: 0 } })
    .sort({ rating: 1 })
    .limit(30);

  let mdContent = `# DineScout AI - Complete Ratings & Market Intelligence Dataset Report\n\n`;
  mdContent += `**Total Database Records Analyzed**: ${totalCount} Zomato Restaurants\n`;
  mdContent += `**Total Cities Covered**: ${cityStats.length}\n`;
  mdContent += `**Total Unique Cuisines Tracked**: ${cuisineStats.length}\n\n`;

  mdContent += `---\n\n## 🏙️ 1. All Cities Rating & Pricing Distribution (${cityStats.length} Cities)\n\n`;
  mdContent += `| # | City | Restaurant Count | Average Rating | Average Cost for Two (₹) | Total Votes |\n`;
  mdContent += `|---|---|---|---|---|---|\n`;

  cityStats.forEach((c, idx) => {
    const name = c._id || "Unknown / Unspecified";
    const rating = c.avgRating ? c.avgRating.toFixed(2) + " ★" : "N/A";
    const cost = c.avgCost ? "₹" + Math.round(c.avgCost) : "N/A";
    mdContent += `| ${idx + 1} | **${name}** | ${c.totalRestaurants} | ${rating} | ${cost} | ${c.totalVotes.toLocaleString()} |\n`;
  });

  mdContent += `\n---\n\n## 🍽️ 2. All Cuisines Rating & Pricing Breakdown (${cuisineStats.length} Cuisines)\n\n`;
  mdContent += `| # | Cuisine | Restaurant Count | Average Rating | Average Cost for Two (₹) |\n`;
  mdContent += `|---|---|---|---|---|\n`;

  cuisineStats.forEach((cu, idx) => {
    const name = cu._id || "Other";
    const rating = cu.avgRating ? cu.avgRating.toFixed(2) + " ★" : "N/A";
    const cost = cu.avgCost ? "₹" + Math.round(cu.avgCost) : "N/A";
    mdContent += `| ${idx + 1} | **${name}** | ${cu.totalRestaurants} | ${rating} | ${cost} |\n`;
  });

  mdContent += `\n---\n\n## 🌟 3. Top 100 Highest Rated Restaurants Across All Regions\n\n`;
  mdContent += `| # | Restaurant Name | City | Locality | Cuisines | Rating | Cost for 2 | Votes | Value Badge |\n`;
  mdContent += `|---|---|---|---|---|---|---|---|---|\n`;

  topRestaurants.forEach((r, idx) => {
    mdContent += `| ${idx + 1} | **${r.name}** | ${r.city || "N/A"} | ${r.locality || "N/A"} | ${r.cuisines} | **${r.rating} ★** | ₹${r.cost} | ${r.votes} | ${r.valueBadge || "Good Value 👍"} |\n`;
  });

  mdContent += `\n---\n\n## ⚠️ 4. Low-Rated & Friction Risk Restaurants Benchmark\n\n`;
  mdContent += `| # | Restaurant Name | City | Cuisines | Rating | Cost for 2 | Friction Points |\n`;
  mdContent += `|---|---|---|---|---|---|---|\n`;

  criticalRiskRestaurants.forEach((r, idx) => {
    const consText = (r.cons && r.cons.length > 0) ? r.cons.join("; ") : "Service delay / Pricing friction";
    mdContent += `| ${idx + 1} | **${r.name}** | ${r.city || "N/A"} | ${r.cuisines} | **${r.rating} ★** | ₹${r.cost} | ${consText} |\n`;
  });

  const artifactPath = "C:\\Users\\tejut\\.gemini\\antigravity-ide\\brain\\1a611d4e-68f2-4dd5-967d-9ca4bd132261\\full_ratings_and_market_data.md";
  fs.writeFileSync(artifactPath, mdContent);
  console.log("Full Markdown Report Written to:", artifactPath);

  await mongoose.disconnect();
}

generateFullReport();
