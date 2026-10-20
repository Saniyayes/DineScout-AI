const axios = require("axios");
const Restaurant = require("../models/Restaurant");
const conversationStore = require("./conversationStore");
const intentClassifier = require("./intentClassifier");

// Haversine Distance Helper in KM
function getDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // KM
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

// Major Indian Cities filter list
const INDIAN_CITIES = [
  "New Delhi", "Gurgaon", "Noida", "Faridabad", "Ghaziabad",
  "Mumbai", "Bengaluru", "Bangalore", "Hyderabad", "Chennai",
  "Kolkata", "Pune", "Jaipur", "Ahmedabad", "Agra", "Goa", "Lucknow"
];

// Default coordinates for Bengaluru center (MG Road / Koramangala)
const BLR_DEFAULT_LAT = 12.9716;
const BLR_DEFAULT_LON = 77.5946;

function getLocalityCoords(localityStr = "", cityStr = "") {
  const loc = (localityStr + " " + cityStr).toLowerCase();
  if (loc.includes("koramangala")) return { lat: 12.9352, lon: 77.6245 };
  if (loc.includes("indiranagar")) return { lat: 12.9784, lon: 77.6408 };
  if (loc.includes("marathahalli")) return { lat: 12.9569, lon: 77.7011 };
  if (loc.includes("whitefield")) return { lat: 12.9698, lon: 77.7500 };
  if (loc.includes("hsr")) return { lat: 12.9121, lon: 77.6446 };
  if (loc.includes("mg road") || loc.includes("brigade")) return { lat: 12.9756, lon: 77.6066 };
  return { lat: BLR_DEFAULT_LAT, lon: BLR_DEFAULT_LON };
}

function formatCompactRestaurant(r, userLat, userLon) {
  let distStr = "";
  const targetLat = userLat || BLR_DEFAULT_LAT;
  const targetLon = userLon || BLR_DEFAULT_LON;

  let rLat = r.latitude ? parseFloat(r.latitude) : null;
  let rLon = r.longitude ? parseFloat(r.longitude) : null;

  if (!rLat || !rLon) {
    const defaultCoords = getLocalityCoords(r.locality, r.city);
    rLat = defaultCoords.lat;
    rLon = defaultCoords.lon;
  }

  const dist = getDistance(targetLat, targetLon, rLat, rLon);
  if (dist !== null) distStr = `${dist} km away`;

  return {
    id: r._id || r.id,
    name: r.name,
    rating: r.rating || 4.0,
    cost: r.cost || 0,
    cuisines: r.cuisines || "Multi-Cuisine",
    valueBadge: r.valueBadge || "Good Value",
    city: r.city || "Bengaluru",
    locality: r.locality || r.city || "Bengaluru",
    address: r.address || "",
    distance: distStr,
    moodTags: r.moodTags || []
  };
}

/**
 * Call Groq, xAI Grok, or Anthropic API to synthesize live natural language response grounded in database facts.
 */
async function generateLLMResponse(systemPrompt, userPrompt) {
  const apiKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY || process.env.GROQ_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (apiKey) {
    const isGroqKey = apiKey.startsWith("gsk_");
    const endpoint = isGroqKey
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://api.x.ai/v1/chat/completions";
    const model = isGroqKey ? "qwen/qwen3.8-27b" : "grok-2-latest";

    try {
      const res = await axios.post(
        endpoint,
        {
          model: model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.5
        },
        {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          timeout: 12000
        }
      );
      let text = res.data?.choices?.[0]?.message?.content || "";
      text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      if (text) return text;
    } catch (err) {
      console.warn("LLM API response synthesis fallback:", err.message);
    }
  }

  if (anthropicApiKey) {
    try {
      const res = await axios.post(
        "https://api.anthropic.com/v1/messages",
        {
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 400,
          messages: [{ role: "user", content: userPrompt }],
          system: systemPrompt
        },
        {
          headers: {
            "x-api-key": anthropicApiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
          },
          timeout: 10000
        }
      );
      let text = res.data?.content?.[0]?.text || "";
      text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      if (text) return text;
    } catch (err) {
      console.warn("Anthropic API response synthesis fallback:", err.message);
    }
  }

  return null;
}

async function processChatMessage(sessionId, message, userRole = "user", locationOpts = {}) {
  const session = conversationStore.getSession(sessionId);
  session.userRole = userRole;

  let deviceLat = locationOpts.lat ? parseFloat(locationOpts.lat) : null;
  let deviceLon = locationOpts.lon ? parseFloat(locationOpts.lon) : null;
  let deviceCity = locationOpts.city || null;

  // 1. Classify intent & extract entities
  const classification = await intentClassifier.classifyIntent(message, session, userRole);
  const { intent, extractedFilters, refinementAction } = classification;

  let replyText = "";
  let restaurantsList = null;
  let quickRepliesList = [];

  // If user query mentions Bengaluru/Bangalore or local spots (Indiranagar, Koramangala), bind coordinates
  if (extractedFilters.city === "bengaluru" || /bengaluru|bangalore|koramangala|indiranagar|marathahalli/i.test(message)) {
    if (!deviceLat || !deviceLon) {
      deviceLat = BLR_DEFAULT_LAT;
      deviceLon = BLR_DEFAULT_LON;
    }
    deviceCity = "Bengaluru";
  }

  // ================= 2. EXECUTE INTENTS =================
  if (intent === "NEW_SEARCH" || intent === "REFINEMENT") {
    let currentFilters = { ...session.lastFilters };

    if (intent === "NEW_SEARCH") {
      currentFilters = {};
    }

    if (extractedFilters.cuisine) currentFilters.cuisine = extractedFilters.cuisine;
    if (extractedFilters.budget) currentFilters.budget = extractedFilters.budget;
    if (extractedFilters.mood) currentFilters.mood = extractedFilters.mood;
    if (extractedFilters.city) currentFilters.city = extractedFilters.city;

    if (refinementAction === "cheaper") {
      const prevCost = currentFilters.budget || 1000;
      currentFilters.budget = Math.max(300, Math.round(prevCost * 0.7));
    } else if (refinementAction === "closer") {
      currentFilters.sort = "distance";
    } else if (refinementAction === "different_cuisine") {
      currentFilters.cuisine = null;
    } else if (refinementAction === "higher_rating") {
      currentFilters.minRating = 4.2;
    }

    const { searchNearby } = require("../services/restaurantService");

    const targetCity = currentFilters.city || deviceCity;
    const calcLat = deviceLat || BLR_DEFAULT_LAT;
    const calcLon = deviceLon || BLR_DEFAULT_LON;
    
    let compactCards = [];
    try {
      const results = await searchNearby({
        lat: calcLat,
        lon: calcLon,
        cuisine: currentFilters.cuisine,
        budget: currentFilters.budget,
        mood: currentFilters.mood,
        city: targetCity,
        limit: 6,
        sortMode: currentFilters.sort || "distance"
      });
      compactCards = results.map(r => formatCompactRestaurant(r, calcLat, calcLon));
    } catch (e) {
      console.warn("SearchNearby failed:", e);
    }

    let fallbackTriggered = false;

    if (compactCards.length === 0) {
      fallbackTriggered = true;
      // Fallback if no specific filter matches
      const fallbackResults = await Restaurant.find({
        $or: [
          { city: { $regex: "bengaluru|bangalore", $options: "i" } },
          { locality: { $regex: "koramangala|indiranagar", $options: "i" } }
        ]
      }).sort({ rating: -1, votes: -1 }).limit(3);
      compactCards = fallbackResults.map(r => formatCompactRestaurant(r, calcLat, calcLon));
    }

    conversationStore.updateSession(sessionId, {
      lastFilters: currentFilters,
      lastRestaurants: compactCards,
      lastTopic: "SEARCH"
    });

    if (fallbackTriggered && (currentFilters.budget || currentFilters.cuisine)) {
      replyText = `I couldn't find any exact matches for that nearby. Would you like to expand the search area or increase the budget? Here are some top-rated places further away:`;
      quickRepliesList = ["Expand search area", `Check under ₹${(currentFilters.budget || 500) + 300}`, "Any cuisine nearby"];
      restaurantsList = compactCards;
    } else {
      // Synthesize live AI response using Groq/Grok LLM API
      const systemPrompt = "You are DineScout AI, a real-time dining assistant in India. Recommend real Indian restaurants matching the user request near their location in 2 friendly, concise sentences highlighting their specific locality (e.g. Koramangala or Indiranagar in Bengaluru). NEVER output raw latitude/longitude coordinates.";
      const userPrompt = `User Query: "${message}". User Location: ${deviceCity || "Bengaluru"}. Extracted Filters: ${JSON.stringify(currentFilters)}. Database Matches: ${JSON.stringify(compactCards.map(c => ({ name: c.name, rating: c.rating, cost: c.cost, badge: c.valueBadge, city: c.city, locality: c.locality, distance: c.distance })))}`;

      const llmReply = await generateLLMResponse(systemPrompt, userPrompt);

      if (llmReply) {
        replyText = llmReply;
      } else {
        replyText = `Here are top rated nearby dining spots in **Bengaluru** matching your request:`;
      }

      restaurantsList = compactCards;
      quickRepliesList = ["Cheaper options", "Higher rating", "Top dishes nearby", "Cafes nearby"];
    }

  } else if (intent === "RESTAURANT_QUESTION") {
    const lastRest = session.lastRestaurants?.[0];
    if (lastRest) {
      const dbRest = await Restaurant.findById(lastRest.id);
      if (dbRest) {
        const pros = (dbRest.pros || ["Great atmosphere", "Quality ingredients"]).join(", ");
        const cons = (dbRest.cons || ["Busy during peak hours"]).join(", ");
        const signatureDishes = (dbRest.dishes || [])
          .filter(d => d.isSignature)
          .map(d => d.name)
          .slice(0, 3)
          .join(", ");

        const systemPrompt = "You are DineScout AI. Summarize why this restaurant in India is rated well and highlight its signature dishes clearly in 2-3 concise bullet points based strictly on facts provided.";
        const userPrompt = `Restaurant Details: Name: "${dbRest.name}", City: "${dbRest.city}", Locality: "${dbRest.locality}", Rating: ${dbRest.rating}, Value: "${dbRest.valueBadge}", Pros: "${pros}", Cons: "${cons}", Signature Dishes: "${signatureDishes}". User Question: "${message}"`;

        const llmReply = await generateLLMResponse(systemPrompt, userPrompt);

        if (llmReply) {
          replyText = llmReply;
        } else {
          replyText = `**${dbRest.name}** (${dbRest.locality || dbRest.city}, ${dbRest.rating} ★, ${dbRest.valueBadge}):\n` +
            `• **Key Strengths**: ${pros}\n` +
            `• **Signature Dishes**: ${signatureDishes || "Specialty Menu Items"}\n` +
            `• **Note**: ${cons}`;
        }

        restaurantsList = [formatCompactRestaurant(dbRest, deviceLat || BLR_DEFAULT_LAT, deviceLon || BLR_DEFAULT_LON)];
      } else {
        replyText = "The selected restaurant offers exceptional value and high diner ratings. Would you like to refine your search?";
      }
    } else {
      replyText = "Which restaurant would you like to know more about? Try searching for a cuisine or vibe in Bengaluru first!";
    }
    quickRepliesList = ["Cheaper", "Show more places", "Top Dishes Explorer"];

  } else if (intent === "OWNER_ANALYTICS") {
    const systemPrompt = "You are DineScout AI Business Advisor for restaurant owners in India. Provide concise strategic market advice based on market benchmarking and customer review insights.";
    const userPrompt = `Owner Query: "${message}". Role: "${userRole}". Location: ${deviceCity || "Bengaluru"}. Last Context Filters: ${JSON.stringify(session.lastFilters || {})}.`;

    const llmReply = await generateLLMResponse(systemPrompt, userPrompt);

    if (llmReply) {
      replyText = llmReply;
    } else {
      replyText = `**DineScout Business Intelligence Summary**:\n` +
        `• **Market Position**: Benchmarking evaluates your restaurant's rating and pricing against city averages.\n` +
        `• **Action Roadmap**: Analyzes diner reviews to surface friction points (wait times, portion sizes) with ROI impact.\n` +
        `Visit the **Owner Intelligence Panel** for detailed competitor charts!`;
    }

    quickRepliesList = ["Run Market Benchmark", "Review Action Items", "Search Diners"];

  } else {
    // GENERAL_FAQ
    const systemPrompt = "You are DineScout AI Assistant in India. Answer the user's question directly and concisely in a friendly, professional tone.";
    const userPrompt = `User Message: "${message}"`;

    const llmReply = await generateLLMResponse(systemPrompt, userPrompt);

    if (llmReply) {
      replyText = llmReply;
    } else {
      replyText = `Welcome to **DineScout AI**!\n` +
        `• **Diners**: Search by mood (*"romantic date in Indiranagar"*), cuisine, or budget (*"under ₹600"*).\n` +
        `• **Owners**: Compare ratings and pricing against local competitors on the Owner Dashboard.`;
    }

    quickRepliesList = ["Places near me in Bengaluru", "Koramangala budget cafes", "Top signature dishes"];
  }

  return {
    reply: replyText,
    restaurants: restaurantsList,
    quickReplies: quickRepliesList,
    intent
  };
}

module.exports = {
  processChatMessage
};
