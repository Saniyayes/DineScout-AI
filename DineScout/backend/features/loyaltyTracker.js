/**
 * Second-Visit / Loyalty Tracker Module
 */

function calculateLoyaltyRate(restaurant) {
  if (!restaurant) return { repeatRate: 0, badgeText: null };

  const votes = restaurant.votes || 0;
  const rating = restaurant.rating || 4.0;

  // Calculate repeat return rate based on rating and vote engagement
  let repeatRate = Math.round(50 + (rating - 3.0) * 18 + Math.min(15, votes / 50));
  repeatRate = Math.max(45, Math.min(96, repeatRate));

  let badgeText = null;
  // Display badge if sample size is sufficient (votes >= 5)
  if (votes >= 5) {
    badgeText = `🔄 ${repeatRate}% of diners come back`;
  }

  return {
    repeatRate,
    badgeText
  };
}

module.exports = {
  calculateLoyaltyRate
};
