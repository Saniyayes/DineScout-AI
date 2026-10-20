/**
 * Voice Review Parsing & Sentiment Extraction Module
 */

const POSITIVE_KEYWORDS = [
  "delicious", "amazing", "great", "excellent", "love", "fantastic",
  "wonderful", "tasty", "fresh", "best", "yummy", "enjoyed", "perfect", "good"
];

const NEGATIVE_KEYWORDS = [
  "bad", "terrible", "horrible", "awful", "cold", "slow", "rude",
  "overpriced", "disappointed", "stale", "dirty", "worst", "poor"
];

function parseVoiceTranscript(transcriptText, explicitRating = null, username = "Anonymous Diner") {
  if (!transcriptText || transcriptText.trim() === "") {
    throw new Error("Voice transcript text is empty");
  }

  const textLower = transcriptText.toLowerCase();

  // 1. Infer Rating if not provided
  let inferredRating = explicitRating ? Number(explicitRating) : 4.0;
  if (!explicitRating) {
    let posCount = 0;
    let negCount = 0;

    POSITIVE_KEYWORDS.forEach(kw => {
      if (textLower.includes(kw)) posCount++;
    });
    NEGATIVE_KEYWORDS.forEach(kw => {
      if (textLower.includes(kw)) negCount++;
    });

    if (posCount > negCount + 2) inferredRating = 5.0;
    else if (posCount > negCount) inferredRating = 4.0;
    else if (negCount > posCount + 2) inferredRating = 1.5;
    else if (negCount > posCount) inferredRating = 2.5;
    else inferredRating = 3.5;
  }

  // 2. Extract Dish Mentions
  const dishesMentioned = [];
  const commonDishes = ["pizza", "pasta", "burger", "biryani", "butter chicken", "tacos", "tiramisu", "salad", "sushi", "coffee", "cake", "noodles"];
  commonDishes.forEach(d => {
    if (textLower.includes(d)) {
      dishesMentioned.push(d);
    }
  });

  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];

  return {
    user: username,
    rating: inferredRating,
    text: `[🎙️ Voice Note Transcript]: "${transcriptText.trim()}"`,
    date: dateStr,
    isVoiceSourced: true,
    audioUrl: `voice_recording_${Date.now()}.mp3`,
    dishesMentioned
  };
}

module.exports = {
  parseVoiceTranscript
};
