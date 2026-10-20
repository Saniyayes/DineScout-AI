const OwnerNotification = require("../models/OwnerNotification");
const Restaurant = require("../models/Restaurant");

async function checkCompetitorChanges(ownerId = "testowner", city = "New Delhi", cuisine = "North Indian", ownerPrice = 800, ownerRating = 4.2) {
  const query = {
    city: { $regex: new RegExp("^" + city.trim() + "$", "i") },
    cuisines: { $regex: cuisine.trim(), $options: "i" }
  };

  const competitors = await Restaurant.find(query).limit(50);
  const notifications = [];

  // 1. Rating crossover check
  const higherRated = competitors.filter(c => c.rating > ownerRating + 0.2);
  if (higherRated.length > 0) {
    const topComp = higherRated[0];
    notifications.push({
      ownerId,
      restaurantName: "Your Restaurant",
      type: "COMPETITOR_RATING",
      title: "⚠️ Competitor Rating Alert",
      message: `${topComp.name} in ${city} achieved a ${topComp.rating} ★ rating (higher than your ${ownerRating} ★ baseline). Consider running customer feedback campaigns.`,
      createdAt: new Date()
    });
  }

  // 2. Pricing shift check
  const lowerPriced = competitors.filter(c => c.cost > 0 && c.cost < ownerPrice * 0.75);
  if (lowerPriced.length > 0) {
    const budgetComp = lowerPriced[0];
    notifications.push({
      ownerId,
      restaurantName: "Your Restaurant",
      type: "COMPETITOR_PRICING",
      title: "💰 Competitor Pricing Under-Cut",
      message: `${budgetComp.name} offers ${cuisine} dining at ₹${budgetComp.cost} for two (25%+ lower than your ₹${ownerPrice} price point).`,
      createdAt: new Date()
    });
  }

  // 3. New Competitor Detection
  if (competitors.length > 10) {
    notifications.push({
      ownerId,
      restaurantName: "Your Restaurant",
      type: "NEW_COMPETITOR",
      title: "🏪 High Competitor Density Signal",
      message: `${competitors.length} active ${cuisine} competitors detected in ${city}. Focus on signature dish differentiation.`,
      createdAt: new Date()
    });
  }

  // Save generated notifications to DB
  for (const n of notifications) {
    await OwnerNotification.create(n);
  }

  return notifications;
}

async function getOwnerNotifications(ownerId = "testowner") {
  const notifs = await OwnerNotification.find({ ownerId }).sort({ createdAt: -1 }).limit(10);
  if (notifs.length === 0) {
    // Generate baseline notifications if empty
    return await checkCompetitorChanges(ownerId);
  }
  return notifs;
}

module.exports = {
  checkCompetitorChanges,
  getOwnerNotifications
};
