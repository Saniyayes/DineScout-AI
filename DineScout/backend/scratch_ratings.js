const mongoose = require("mongoose");
const Restaurant = require("./models/Restaurant");

async function run() {
  await mongoose.connect("mongodb://127.0.0.1:27017/dinescout");

  const topCities = await Restaurant.aggregate([
    {
      $group: {
        _id: "$city",
        avgRating: { $avg: "$rating" },
        avgCost: { $avg: "$cost" },
        totalRestaurants: { $sum: 1 },
        totalVotes: { $sum: "$votes" }
      }
    },
    { $sort: { totalRestaurants: -1 } },
    { $limit: 25 }
  ]);

  const topCuisines = await Restaurant.aggregate([
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
    { $sort: { totalRestaurants: -1 } },
    { $limit: 30 }
  ]);

  console.log("=== TOP CITIES ===");
  console.log(JSON.stringify(topCities, null, 2));

  console.log("=== TOP CUISINES ===");
  console.log(JSON.stringify(topCuisines, null, 2));

  await mongoose.disconnect();
}

run();
