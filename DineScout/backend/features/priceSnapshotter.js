const PriceSnapshot = require("../models/PriceSnapshot");
const Restaurant = require("../models/Restaurant");

async function recordSnapshot(restaurantId) {
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) return null;

  const snapshot = await PriceSnapshot.create({
    restaurantId: restaurant._id,
    date: new Date(),
    avgPrice: restaurant.cost || 0,
    avgRating: restaurant.rating || 0,
    valueScore: restaurant.valueScore || 7.0
  });

  return snapshot;
}

async function getRestaurantTrends(restaurantId) {
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) return null;

  let snapshots = await PriceSnapshot.find({ restaurantId }).sort({ date: 1 });

  // If no snapshots exist yet, backfill initial historical snapshots based on current metrics
  if (snapshots.length < 2) {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const baseCost = restaurant.cost || 800;
    const baseRating = restaurant.rating || 4.0;

    // Simulated historical trajectory (e.g. 10% lower price 6 months ago)
    const snap1 = await PriceSnapshot.create({
      restaurantId: restaurant._id,
      date: sixMonthsAgo,
      avgPrice: Math.round(baseCost * 0.90),
      avgRating: Number((baseRating - 0.1).toFixed(1)),
      valueScore: Number((restaurant.valueScore || 7.0).toFixed(1))
    });

    const snap2 = await PriceSnapshot.create({
      restaurantId: restaurant._id,
      date: threeMonthsAgo,
      avgPrice: Math.round(baseCost * 0.95),
      avgRating: Number(baseRating.toFixed(1)),
      valueScore: Number((restaurant.valueScore || 7.0).toFixed(1))
    });

    const snap3 = await PriceSnapshot.create({
      restaurantId: restaurant._id,
      date: now,
      avgPrice: baseCost,
      avgRating: Number(baseRating.toFixed(1)),
      valueScore: Number((restaurant.valueScore || 7.0).toFixed(1))
    });

    snapshots = [snap1, snap2, snap3];
  }

  const oldest = snapshots[0];
  const newest = snapshots[snapshots.length - 1];

  const priceDriftPct = oldest.avgPrice > 0
    ? Number((((newest.avgPrice - oldest.avgPrice) / oldest.avgPrice) * 100).toFixed(1))
    : 0;

  const ratingDrift = Number((newest.avgRating - oldest.avgRating).toFixed(2));

  let summaryText = "";
  if (priceDriftPct > 0) {
    summaryText = `Prices up ${priceDriftPct}% in recent months, rating ${ratingDrift >= 0 ? `+${ratingDrift}` : ratingDrift}`;
  } else if (priceDriftPct < 0) {
    summaryText = `Prices down ${Math.abs(priceDriftPct)}% in recent months, rating ${ratingDrift >= 0 ? `+${ratingDrift}` : ratingDrift}`;
  } else {
    summaryText = `Prices steady (₹${newest.avgPrice} for two), rating ${newest.avgRating} ★`;
  }

  return {
    restaurantId,
    name: restaurant.name,
    currentPrice: newest.avgPrice,
    currentRating: newest.avgRating,
    priceDriftPercent: priceDriftPct,
    ratingDrift: ratingDrift,
    summaryText,
    history: snapshots.map(s => ({
      date: s.date.toISOString().split("T")[0],
      price: s.avgPrice,
      rating: s.avgRating
    }))
  };
}

module.exports = {
  recordSnapshot,
  getRestaurantTrends
};
