const mongoose = require("mongoose");

const notificationPreferenceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  mutedOwners: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  mutedTypes: [{ type: String }] // e.g. ["Event", "Announcement"]
});

module.exports = mongoose.model("NotificationPreference", notificationPreferenceSchema);
