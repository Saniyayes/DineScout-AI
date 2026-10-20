/**
 * Regret Radar - Personalized Mismatch Warning Annotation Layer
 */

function evaluateMismatchWarnings(restaurant, userDislikedFlavors = ["expensive", "spicy"]) {
  if (!restaurant || !userDislikedFlavors || userDislikedFlavors.length === 0) {
    return null;
  }

  const moodTags = (restaurant.moodTags || []).map(t => t.toLowerCase());
  const cuisines = (restaurant.cuisines || "").toLowerCase();
  const warningFlags = [];

  userDislikedFlavors.forEach(dislike => {
    const dLower = dislike.toLowerCase().trim();
    if (dLower === "spicy" && (moodTags.includes("spicy") || cuisines.includes("indian") || cuisines.includes("mexican") || cuisines.includes("asian") || cuisines.includes("japanese"))) {
      warningFlags.push("⚠️ High spice level (matches your skipped flavor preference)");
    }
    if (dLower === "expensive" && (restaurant.cost >= 1200)) {
      warningFlags.push("⚠️ Premium cost alert (above your average dining budget)");
    }
  });

  return warningFlags.length > 0 ? warningFlags[0] : null;
}

function annotateResultsWithRadar(results = [], userDislikes = ["expensive", "spicy"]) {
  return results.map(r => {
    const warning = evaluateMismatchWarnings(r, userDislikes);
    return {
      ...r,
      regretWarning: warning
    };
  });
}

module.exports = {
  evaluateMismatchWarnings,
  annotateResultsWithRadar
};
