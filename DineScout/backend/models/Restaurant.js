const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema({
  user: String,
  rating: Number,
  text: String,
  date: String,
  isVoiceSourced: { type: Boolean, default: false },
  audioUrl: { type: String, default: "" }
}, { _id: false });

const dishSchema = new mongoose.Schema({
  name: String,
  category: String,
  price: Number,
  rating: Number,
  isSignature: { type: Boolean, default: false }
}, { _id: false });

const restaurantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  cuisines: { type: String, default: "" },
  rating: { type: Number, default: 0 },
  cost: { type: Number, default: 0 },
  latitude: { type: Number, default: 0 },
  longitude: { type: Number, default: 0 },
  city: { type: String, default: "" },
  address: { type: String, default: "" },
  locality: { type: String, default: "" },
  priceRange: { type: Number, default: 1 },
  votes: { type: Number, default: 0 },
  ratingText: { type: String, default: "Average" },
  valueScore: { type: Number, default: 7.0 },
  valueBadge: { type: String, default: "Good Value 👍" },
  reviewConfidenceScore: { type: Number, default: 85 },
  reviewConfidenceLevel: { type: String, default: "High" },
  spamFlags: [{ type: String }],
  moodTags: [{ type: String }],
  pros: [{ type: String }],
  cons: [{ type: String }],
  reviews: [reviewSchema],
  dishes: [dishSchema],
  photos: [{
    url: String,
    attribution: String
  }]
});

// Index for fast search and geo/text queries
restaurantSchema.index({ name: "text", cuisines: "text", moodTags: "text" });

module.exports = mongoose.model("Restaurant", restaurantSchema);

