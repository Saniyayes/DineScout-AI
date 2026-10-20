const Restaurant = require("../models/Restaurant");

let cachedBands = null;

async function getBudgetBands() {
  if (cachedBands) return cachedBands;

  try {
    const restaurants = await Restaurant.find({ cost: { $gt: 0 } }, { cost: 1 });
    if (restaurants.length === 0) {
      return { cheap: 400, mid: 900 }; // fallback
    }

    const costs = restaurants.map(r => r.cost).sort((a, b) => a - b);
    
    // 33rd percentile for 'cheap' boundary
    const p33 = costs[Math.floor(costs.length * 0.33)] || 400;
    
    // 66th percentile for 'mid-range' boundary
    const p66 = costs[Math.floor(costs.length * 0.66)] || 900;

    cachedBands = {
      cheap: p33,
      mid: p66
    };

    return cachedBands;
  } catch (err) {
    console.error("Failed to compute budget bands, using defaults:", err);
    return { cheap: 400, mid: 900 };
  }
}

module.exports = {
  getBudgetBands
};
