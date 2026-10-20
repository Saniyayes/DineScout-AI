const mongoose = require("mongoose");

const userNotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  notificationId: { type: mongoose.Schema.Types.ObjectId, ref: "Notification", required: true },
  isRead: { type: Boolean, default: false },
  readAt: { type: Date, default: null },
  isClicked: { type: Boolean, default: false },
  clickedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("UserNotification", userNotificationSchema);
