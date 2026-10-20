const axios = require("axios");

const { getBudgetBands } = require("./budgetBands");

/**
 * Classifies user message into intent and extracts filter entities using live Groq / xAI LLM endpoints.
 */
async function classifyIntent(message, sessionContext, role) {
  const msgLower = (message || "").toLowerCase().trim();
  const apiKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY || process.env.GROQ_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  const budgetBands = await getBudgetBands();

  const systemPrompt = `You are the NLU intent classifier for DineScout AI.
Analyze the user message and output strictly valid JSON without any thinking tags, markdown, or extra prose.
IMPORTANT: Map vague budget terms into specific numbers based on these dataset percentiles:
- "cheap" / "budget" -> map to budget: ${budgetBands.cheap}
- "mid-range" / "affordable" -> map to budget: ${budgetBands.mid}
- explicit amounts ("under 500") -> map to that exact number.
- no budget mentioned -> map to budget: null. Do not guess a budget if not mentioned.

JSON shape required:
{
  "intent": "NEW_SEARCH" | "REFINEMENT" | "RESTAURANT_QUESTION" | "OWNER_ANALYTICS" | "GENERAL_FAQ",
  "extractedFilters": {
    "cuisine": string or null,
    "budget": number or null,
    "mood": string or null,
    "city": string or null,
    "sort": "distance" | "rating" | "value" | null
  },
  "refinementAction": "cheaper" | "closer" | "different_cuisine" | "higher_rating" | null
}
User Role: ${role || "user"}.
Previous Context Filters: ${JSON.stringify(sessionContext.lastFilters || {})}.`;

  // 1. Try Groq API or xAI API if key is present
  if (apiKey) {
    const isGroqKey = apiKey.startsWith("gsk_");
    const endpoint = isGroqKey
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://api.x.ai/v1/chat/completions";
    const model = isGroqKey ? "qwen/qwen3.8-27b" : "grok-2-latest";

    try {
      const response = await axios.post(
        endpoint,
        {
          model: model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message }
          ],
          temperature: 0.1
        },
        {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          timeout: 10000
        }
      );

      let contentText = response.data?.choices?.[0]?.message?.content || "";
      // Strip thinking tags if returned by reasoning models
      contentText = contentText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

      const jsonMatch = contentText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (err) {
      console.warn("LLM API Intent Classification fallback:", err.message);
    }
  }

  // 2. Try Anthropic API
  if (anthropicApiKey) {
    try {
      const response = await axios.post(
        "https://api.anthropic.com/v1/messages",
        {
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 300,
          messages: [{ role: "user", content: message }],
          system: systemPrompt
        },
        {
          headers: {
            "x-api-key": anthropicApiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
          },
          timeout: 8000
        }
      );

      let contentText = response.data?.content?.[0]?.text || "";
      contentText = contentText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      const jsonMatch = contentText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (err) {
      console.warn("Anthropic API Intent Classification fallback:", err.message);
    }
  }

  // 3. Fallback to rule-based classification
  return fallbackRuleClassifier(msgLower, sessionContext, role, budgetBands);
}

function fallbackRuleClassifier(msgLower, sessionContext, role, budgetBands) {
  if (
    role === "owner" ||
    msgLower.includes("competitor") ||
    msgLower.includes("benchmark") ||
    msgLower.includes("market share") ||
    msgLower.includes("action items") ||
    msgLower.includes("roadmap") ||
    msgLower.includes("feasibility") ||
    msgLower.includes("how do i compare")
  ) {
    return {
      intent: "OWNER_ANALYTICS",
      extractedFilters: {},
      refinementAction: null
    };
  }

  const isRefinement =
    msgLower.includes("cheap") ||
    msgLower.includes("budget") ||
    msgLower.includes("closer") ||
    msgLower.includes("nearer") ||
    msgLower.includes("different cuisine") ||
    msgLower.includes("other cuisine") ||
    msgLower.includes("higher rating") ||
    msgLower.includes("better rating") ||
    msgLower.includes("more options") ||
    msgLower.includes("instead");

  if (isRefinement && sessionContext.lastRestaurants && sessionContext.lastRestaurants.length > 0) {
    let action = null;
    if (msgLower.includes("cheap") || msgLower.includes("budget")) action = "cheaper";
    else if (msgLower.includes("closer") || msgLower.includes("nearer")) action = "closer";
    else if (msgLower.includes("different") || msgLower.includes("other")) action = "different_cuisine";
    else if (msgLower.includes("rating") || msgLower.includes("better")) action = "higher_rating";

    return {
      intent: "REFINEMENT",
      extractedFilters: extractBasicEntities(msgLower, budgetBands),
      refinementAction: action
    };
  }

  if (
    msgLower.includes("signature dish") ||
    msgLower.includes("why is it rated") ||
    msgLower.includes("review summary") ||
    msgLower.includes("pros and cons") ||
    msgLower.includes("tell me more about") ||
    msgLower.includes("what do people say")
  ) {
    return {
      intent: "RESTAURANT_QUESTION",
      extractedFilters: {},
      refinementAction: null
    };
  }

  if (
    msgLower.includes("help") ||
    msgLower.includes("how to use") ||
    msgLower.includes("what can you do") ||
    msgLower.includes("who are you") ||
    msgLower.includes("dinescout")
  ) {
    return {
      intent: "GENERAL_FAQ",
      extractedFilters: {},
      refinementAction: null
    };
  }

  return {
    intent: "NEW_SEARCH",
    extractedFilters: extractBasicEntities(msgLower, budgetBands),
    refinementAction: null
  };
}

function extractBasicEntities(text, budgetBands) {
  const filters = { cuisine: null, budget: null, mood: null, city: null };
  const cuisines = ["italian", "chinese", "north indian", "south indian", "continental", "cafe", "bakery", "japanese", "mexican", "desserts", "fast food", "mughlai", "biryani", "american", "mediterranean", "thai"];
  for (const c of cuisines) {
    if (text.includes(c)) { filters.cuisine = c; break; }
  }
  const budgetMatch = text.match(/(?:under|below|max|budget|rs\.?|₹)\s*(\d+)/i) || text.match(/(\d+)\s*(?:rs|rupees|inr|₹)/i);
  if (budgetMatch) { 
    filters.budget = parseInt(budgetMatch[1], 10); 
  } else if (text.includes("cheap") || text.includes("budget") || text.includes("affordable")) {
    filters.budget = budgetBands.cheap;
  } else if (text.includes("mid-range") || text.includes("moderate")) {
    filters.budget = budgetBands.mid;
  }
  const moods = ["romantic", "quiet", "cozy", "budget", "party", "family", "healthy", "work"];
  for (const m of moods) {
    if (text.includes(m)) { filters.mood = m; break; }
  }
  const blrKeywords = ["bengaluru", "bangalore", "byb location", "near by", "nearby", "koramangala", "indiranagar", "hsr", "whitefield", "mg road", "lavelle"];
  for (const k of blrKeywords) {
    if (text.includes(k)) { filters.city = "bengaluru"; break; }
  }
  if (!filters.city) {
    const cities = ["new delhi", "delhi", "mumbai", "pune", "hyderabad", "chennai", "kolkata", "ahmedabad", "jaipur"];
    for (const ct of cities) {
      if (text.includes(ct)) { filters.city = ct; break; }
    }
  }
  return filters;
}

module.exports = {
  classifyIntent
};
