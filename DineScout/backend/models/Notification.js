const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: {
    type: String,
    enum: ["Offer", "Event", "New Menu", "Announcement"],
    default: "Announcement"
  },
  audienceType: {
    type: String,
    enum: ["All", "Nearby", "Saved"],
    default: "All"
  },
  audienceRadius: { type: Number, default: null }, // in km, if applicable
  status: {
    type: String,
    enum: ["Draft", "Scheduled", "Sent"],
    default: "Draft"
  },
  scheduledAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null },
  stats: {
    delivered: { type: Number, default: 0 },
    read: { type: Number, default: 0 },
    clicked: { type: Number, default: 0 }
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Notification", notificationSchema);
