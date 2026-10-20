const mongoose = require("mongoose");

const priceSnapshotSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true },
  date: { type: Date, default: Date.now },
  avgPrice: { type: Number, required: true },
  avgRating: { type: Number, required: true },
  valueScore: { type: Number, default: 7.0 }
});

priceSnapshotSchema.index({ restaurantId: 1, date: -1 });

module.exports = mongoose.model("PriceSnapshot", priceSnapshotSchema);
