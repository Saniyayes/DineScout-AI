const mongoose = require("mongoose");

const ownerNotificationSchema = new mongoose.Schema({
  ownerId: { type: String, required: true },
  restaurantName: { type: String, default: "Your Restaurant" },
  type: { type: String, enum: ["COMPETITOR_PRICING", "COMPETITOR_RATING", "NEW_COMPETITOR"], default: "COMPETITOR_PRICING" },
  title: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  read: { type: Boolean, default: false }
});

ownerNotificationSchema.index({ ownerId: 1, createdAt: -1 });

module.exports = mongoose.model("OwnerNotification", ownerNotificationSchema);
