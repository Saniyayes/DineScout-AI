const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  restaurantName: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  text: { type: String, required: true },
  tags: [{ type: String }], // Food, Service, Price, Ambiance
  createdAt: { type: Date, default: Date.now }
});

reviewSchema.index({ userId: 1, restaurantId: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
