const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  restaurantName: { type: String, required: true },
  locality: { type: String },
  city: { type: String },
  createdAt: { type: Date, default: Date.now }
});

favoriteSchema.index({ userId: 1, restaurantId: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);
