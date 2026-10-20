/**
 * Rule-based statistical spam and authenticity scorer for restaurant reviews
 */

// Helper to calculate Jaccard similarity between two strings
function getJaccardSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;
  const set1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const set2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  if (set1.size === 0 || set2.size === 0) return 0;

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

function analyzeReviewAuthenticity(reviews = []) {
  let score = 95; // Default base confidence
  const flags = [];

  if (!reviews || reviews.length === 0) {
    return {
      score: 90,
      level: "High",
      flags: ["No suspicious review patterns detected (Insufficient reviews)"]
    };
  }

  // 1. BURST DETECTION: Check for clusters of 5-star reviews on the same date
  const dateCounts = {};
  reviews.forEach(r => {
    if (r.date && r.rating >= 4.5) {
      const d = r.date.split(" ")[0]; // Get YYYY-MM-DD or date part
      dateCounts[d] = (dateCounts[d] || 0) + 1;
    }
  });

  let maxBurstOnSingleDate = 0;
  for (const date in dateCounts) {
    if (dateCounts[date] > maxBurstOnSingleDate) {
      maxBurstOnSingleDate = dateCounts[date];
    }
  }

  if (maxBurstOnSingleDate >= 3) {
    score -= 25;
    flags.push(`Suspicious 5-star review burst detected (${maxBurstOnSingleDate} in 24h)`);
  }

  // 2. TEXT REPETITION / TEMPLATED PHRASING: Compare pairs of reviews
  let highlySimilarPairs = 0;
  for (let i = 0; i < reviews.length; i++) {
    for (let j = i + 1; j < reviews.length; j++) {
      const sim = getJaccardSimilarity(reviews[i].text, reviews[j].text);
      if (sim > 0.55) {
        highlySimilarPairs++;
      }
    }
  }

  if (highlySimilarPairs > 0) {
    score -= Math.min(30, highlySimilarPairs * 15);
    flags.push(`Repetitive/templated review text phrasing detected (${highlySimilarPairs} pairs)`);
  }

  // 3. EXTREME RATING DISTRIBUTION SKEW
  const fiveStars = reviews.filter(r => r.rating === 5).length;
  const oneStars = reviews.filter(r => r.rating === 1).length;
  const total = reviews.length;

  if (total >= 4 && (fiveStars / total) >= 0.85) {
    score -= 15;
    flags.push("Unnatural 5-star rating distribution concentration (>85% 5-stars)");
  }

  if (total >= 4 && (oneStars / total) >= 0.50) {
    score -= 20;
    flags.push("High negative review polarization (>50% 1-stars)");
  }

  // Ensure score is bounded [10, 100]
  score = Math.max(10, Math.min(100, Math.round(score)));

  let level = "High";
  if (score < 55) {
    level = "Low";
  } else if (score < 78) {
    level = "Medium";
  }

  if (flags.length === 0) {
    flags.push("Verified authentic diner review distribution");
  }

  return {
    score,
    level,
    flags
  };
}

module.exports = {
  analyzeReviewAuthenticity
};
