const mongoose = require("mongoose");
const csv = require("csvtojson");
const path = require("path");
const Restaurant = require("./models/Restaurant");
require("dotenv").config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/dinescout";

// Dish database categorized by cuisine
const CUISINE_DISHES = {
  "north indian": [
    { name: "Butter Chicken", category: "Mains", priceRatio: 0.35, isSignature: true },
    { name: "Dal Makhani", category: "Mains", priceRatio: 0.25, isSignature: true },
    { name: "Paneer Tikka Masala", category: "Mains", priceRatio: 0.28, isSignature: false },
    { name: "Garlic Butter Naan", category: "Breads", priceRatio: 0.08, isSignature: false },
    { name: "Gulab Jamun with Rabri", category: "Dessert", priceRatio: 0.15, isSignature: false }
  ],
  "south indian": [
    { name: "Masala Dosa", category: "Mains", priceRatio: 0.20, isSignature: true },
    { name: "Ghee Roast Idli", category: "Starters", priceRatio: 0.18, isSignature: true },
    { name: "Filter Coffee", category: "Beverages", priceRatio: 0.10, isSignature: false },
    { name: "Medu Vada Platter", category: "Starters", priceRatio: 0.15, isSignature: false }
  ],
  "chinese": [
    { name: "Crispy Chilli Chicken", category: "Starters", priceRatio: 0.28, isSignature: true },
    { name: "Dim Sum Basket", category: "Starters", priceRatio: 0.32, isSignature: true },
    { name: "Hakka Noodles", category: "Mains", priceRatio: 0.22, isSignature: false },
    { name: "Kung Pao Tofu", category: "Mains", priceRatio: 0.26, isSignature: false }
  ],
  "italian": [
    { name: "Wood-Fired Margherita Pizza", category: "Mains", priceRatio: 0.38, isSignature: true },
    { name: "Truffle Mushroom Pasta", category: "Mains", priceRatio: 0.35, isSignature: true },
    { name: "Classic Tiramisu", category: "Dessert", priceRatio: 0.22, isSignature: true },
    { name: "Bruschetta Trio", category: "Starters", priceRatio: 0.20, isSignature: false }
  ],
  "cafe": [
    { name: "Artisanal Cappuccino", category: "Beverages", priceRatio: 0.18, isSignature: true },
    { name: "Avocado Sourdough Toast", category: "Mains", priceRatio: 0.30, isSignature: true },
    { name: "Blueberry Cheesecake", category: "Dessert", priceRatio: 0.22, isSignature: true },
    { name: "Grilled Club Sandwich", category: "Mains", priceRatio: 0.25, isSignature: false }
  ],
  "fast food": [
    { name: "Smash Cheeseburger", category: "Mains", priceRatio: 0.28, isSignature: true },
    { name: "Loaded Peri Peri Fries", category: "Sides", priceRatio: 0.18, isSignature: false },
    { name: "Thick Chocolate Shake", category: "Beverages", priceRatio: 0.20, isSignature: true }
  ],
  "japanese": [
    { name: "Salmon Nigiri & Roll Platter", category: "Mains", priceRatio: 0.45, isSignature: true },
    { name: "Rich Tonkotsu / Veg Ramen", category: "Mains", priceRatio: 0.35, isSignature: true },
    { name: "Crispy Prawn Tempura", category: "Starters", priceRatio: 0.30, isSignature: false },
    { name: "Matcha Ice Cream", category: "Dessert", priceRatio: 0.18, isSignature: false }
  ],
  "mexican": [
    { name: "Sizzling Fajitas", category: "Mains", priceRatio: 0.36, isSignature: true },
    { name: "Loaded Nachos Supreme", category: "Starters", priceRatio: 0.26, isSignature: true },
    { name: "Street Style Tacos", category: "Mains", priceRatio: 0.28, isSignature: false }
  ],
  "desserts": [
    { name: "Molten Lava Cake", category: "Dessert", priceRatio: 0.30, isSignature: true },
    { name: "Belgian Waffle with Gelato", category: "Dessert", priceRatio: 0.32, isSignature: true },
    { name: "Artisan Macaron Box", category: "Dessert", priceRatio: 0.28, isSignature: false }
  ]
};

// Default generic dishes if cuisine does not match specific set
const GENERIC_DISHES = [
  { name: "Chef's Special Tasting Platter", category: "Mains", priceRatio: 0.40, isSignature: true },
  { name: "Signature House Soup & Salad", category: "Starters", priceRatio: 0.22, isSignature: false },
  { name: "House Crafted Mocktail", category: "Beverages", priceRatio: 0.18, isSignature: false },
  { name: "Artisanal Dessert of the Day", category: "Dessert", priceRatio: 0.20, isSignature: true }
];

function generateMoodTags(cuisinesStr, cost, rating) {
  const tags = new Set();
  const cLower = (cuisinesStr || "").toLowerCase();

  // Price & ambience based
  if (cost >= 1500 || rating >= 4.4) {
    tags.add("Romantic");
    tags.add("Date Night");
    tags.add("Fine Dining");
    tags.add("Luxury");
  }
  if (cost <= 600) {
    tags.add("Budget Friendly");
    tags.add("Pocket Friendly");
    tags.add("Quick Bites");
  }
  if (cLower.includes("cafe") || cLower.includes("coffee") || cLower.includes("bakery")) {
    tags.add("Quiet & Cozy");
    tags.add("Work Friendly");
    tags.add("Coffee & Conversations");
    tags.add("Relaxed");
  }
  if (cLower.includes("bar") || cLower.includes("pub") || cLower.includes("cocktail")) {
    tags.add("Party & Nightlife");
    tags.add("Lively");
    tags.add("Drinks & Music");
  }
  if (cLower.includes("fast food") || cLower.includes("street food") || cLower.includes("pizza") || cLower.includes("burger")) {
    tags.add("Casual Hangout");
    tags.add("Late Night");
    tags.add("Friends Gathering");
  }
  if (cLower.includes("north indian") || cLower.includes("south indian") || cLower.includes("biryani") || cLower.includes("thali")) {
    tags.add("Family Friendly");
    tags.add("Celebrations");
    tags.add("Comfort Food");
  }
  if (cLower.includes("healthy") || cLower.includes("salad") || cLower.includes("continental") || cLower.includes("italian")) {
    tags.add("Healthy & Fresh");
    tags.add("Brunch Spot");
    tags.add("Aesthetic Ambience");
  }
  if (rating >= 4.5) {
    tags.add("Top Rated");
    tags.add("Crowd Favorite");
  }

  // Ensure every restaurant has at least 3 mood tags
  if (tags.size < 3) {
    tags.add("Casual Dining");
    tags.add("Good Food");
    tags.add("Friends & Family");
  }

  return Array.from(tags);
}

function calculateValueForMoney(cost, rating, votes) {
  // Safe defaults
  const c = Math.max(cost, 100);
  const r = rating > 0 ? rating : 3.2;
  const v = Math.min(votes || 50, 1000);

  // Normalization logic: High rating at reasonable cost = high value score
  // Typical cost for two ranges: 200 - 3000
  // Normalization baseline: 600 cost with 4.0 rating is ~8.0 score
  let baseScore = (r / 5.0) * 10;
  
  // Cost factor: lower cost gives bonus, high cost requires stellar rating
  let costFactor = 0;
  if (c <= 400) costFactor = 1.2;
  else if (c <= 800) costFactor = 0.6;
  else if (c <= 1500) costFactor = 0.0;
  else costFactor = -0.6;

  // Vote confidence bonus
  let voteConfidence = (Math.log10(v + 1) / 3.0) * 0.5;

  let valueScore = Math.min(9.9, Math.max(4.5, baseScore + costFactor + voteConfidence));
  valueScore = Math.round(valueScore * 10) / 10;

  let valueBadge = "Good Value 👍";
  if (valueScore >= 8.8) {
    valueBadge = "Exceptional Value 💎";
  } else if (valueScore >= 7.8) {
    valueBadge = "Great Value ⭐";
  } else if (valueScore >= 6.5) {
    valueBadge = "Good Value 👍";
  } else {
    valueBadge = "Premium Experience ⚖️";
  }

  return { valueScore, valueBadge };
}

function generateProsCons(cuisinesStr, cost, rating, name) {
  const pros = [];
  const cons = [];
  const cLower = (cuisinesStr || "").toLowerCase();

  if (rating >= 4.2) {
    pros.push("Consistent high quality and rich, authentic flavors");
    pros.push("Courteous, prompt, and attentive service");
    pros.push("Pleasant interior design with welcoming ambience");
    cons.push("High demand during weekend peak hours (expect 15-20m wait)");
    cons.push("Table reservations recommended for dinner");
  } else if (rating >= 3.5) {
    pros.push("Satisfying portions and tasty standard recipes");
    pros.push("Comfortable seating suitable for casual gatherings");
    cons.push("Service speed can vary slightly during peak rush");
    cons.push("Parking space can be limited near entrance");
  } else {
    pros.push("Pocket friendly pricing and quick counter turnaround");
    pros.push("Good for quick casual bites on the go");
    cons.push("Ambience is basic and functional");
    cons.push("Menu variety could be expanded");
  }

  if (cost <= 500) {
    pros.push("Super budget-friendly with great value for money");
  } else if (cost >= 1800) {
    cons.push("Premium pricing reflective of upscale dining style");
  }

  return { pros: pros.slice(0, 3), cons: cons.slice(0, 2) };
}

function generateDishes(cuisinesStr, cost, rating) {
  const dishes = [];
  const cLower = (cuisinesStr || "").toLowerCase();
  let matchedCategory = null;

  for (const key of Object.keys(CUISINE_DISHES)) {
    if (cLower.includes(key)) {
      matchedCategory = key;
      break;
    }
  }

  const dishList = matchedCategory ? CUISINE_DISHES[matchedCategory] : GENERIC_DISHES;
  const baseCost = Math.max(cost, 250);

  for (const item of dishList) {
    const dishPrice = Math.max(50, Math.round((baseCost * item.priceRatio) / 10) * 10);
    const dishRating = Math.min(5.0, Math.max(3.8, Math.round((rating + (Math.random() * 0.4 - 0.2)) * 10) / 10));
    dishes.push({
      name: item.name,
      category: item.category,
      price: dishPrice,
      rating: dishRating,
      isSignature: item.isSignature
    });
  }

  return dishes;
}

function generateReviews(name, cuisinesStr, rating, valueScore) {
  const reviewers = ["Aarav M.", "Priya S.", "Rohan K.", "Ananya D.", "Vikram T."];
  const reviews = [
    {
      user: reviewers[0],
      rating: Math.min(5, Math.max(3, Math.round(rating))),
      text: `Loved the dining experience at ${name}! The ${cuisinesStr.split(",")[0] || "food"} was fresh, perfectly seasoned, and served piping hot.`,
      date: "2026-02-14"
    },
    {
      user: reviewers[1],
      rating: Math.min(5, Math.max(3, Math.round(rating - 0.2))),
      text: `Great atmosphere and friendly staff. Value for money score of ${valueScore}/10 is well deserved!`,
      date: "2026-02-10"
    },
    {
      user: reviewers[2],
      rating: Math.min(5, Math.max(3, Math.round(rating + 0.1))),
      text: "Portion sizes are generous and signature dishes lived up to the hype. Will definitely visit again.",
      date: "2026-01-28"
    }
  ];
  return reviews;
}

async function enrich() {
  try {
    console.log("Connecting to MongoDB:", MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log("Connected successfully! Starting data enrichment...");

    const csvFilePath = path.join(__dirname, "../dataset/zomato.csv");
    const rawData = await csv().fromFile(csvFilePath);
    console.log(`Read ${rawData.length} rows from CSV.`);

    // Build lookup map by Restaurant ID or Name
    const lookup = new Map();
    for (const r of rawData) {
      const id = r["Restaurant ID"];
      lookup.set(id, r);
      lookup.set(r["Restaurant Name"] + "_" + r["Latitude"], r);
    }

    const restaurants = await Restaurant.find({});
    console.log(`Found ${restaurants.length} existing restaurants in MongoDB to enrich.`);

    let updatedCount = 0;
    const bulkOps = [];

    for (const doc of restaurants) {
      const key = doc.name + "_" + doc.latitude;
      const csvMatch = lookup.get(key) || rawData.find(r => r["Restaurant Name"] === doc.name) || {};

      const city = csvMatch["City"] || "New Delhi";
      const address = csvMatch["Address"] || `${doc.name}, ${city}`;
      const locality = csvMatch["Locality"] || city;
      const priceRange = Number(csvMatch["Price range"]) || (doc.cost > 1500 ? 4 : doc.cost > 800 ? 3 : doc.cost > 400 ? 2 : 1);
      const votes = Number(csvMatch["Votes"]) || Math.floor(Math.random() * 400 + 50);
      const ratingText = csvMatch["Rating text"] || (doc.rating >= 4.0 ? "Very Good" : doc.rating >= 3.0 ? "Good" : "Average");

      const moodTags = generateMoodTags(doc.cuisines, doc.cost, doc.rating);
      const { valueScore, valueBadge } = calculateValueForMoney(doc.cost, doc.rating, votes);
      const { pros, cons } = generateProsCons(doc.cuisines, doc.cost, doc.rating, doc.name);
      const dishes = generateDishes(doc.cuisines, doc.cost, doc.rating);
      const reviews = generateReviews(doc.name, doc.cuisines, doc.rating, valueScore);

      bulkOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              city,
              address,
              locality,
              priceRange,
              votes,
              ratingText,
              valueScore,
              valueBadge,
              moodTags,
              pros,
              cons,
              dishes,
              reviews
            }
          }
        }
      });

      if (bulkOps.length >= 500) {
        await Restaurant.bulkWrite(bulkOps);
        updatedCount += bulkOps.length;
        console.log(`Enriched ${updatedCount} / ${restaurants.length} records...`);
        bulkOps.length = 0;
      }
    }

    if (bulkOps.length > 0) {
      await Restaurant.bulkWrite(bulkOps);
      updatedCount += bulkOps.length;
    }

    console.log(`✅ Successfully enriched all ${updatedCount} restaurants in MongoDB!`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Enrichment Error:", err);
    process.exit(1);
  }
}

enrich();
