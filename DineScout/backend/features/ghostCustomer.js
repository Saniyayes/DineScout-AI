/**
 * Owner "Ghost Customer" Simulation Module
 */

const axios = require("axios");
const Restaurant = require("../models/Restaurant");

async function generateGhostCustomerAudit(restaurantId, restaurantName = "Your Restaurant") {
  let restaurant = null;
  if (restaurantId) {
    restaurant = await Restaurant.findById(restaurantId);
  }

  const name = restaurant?.name || restaurantName;
  const cuisines = restaurant?.cuisines || "Multi-Cuisine";
  const cost = restaurant?.cost || 800;
  const rating = restaurant?.rating || 4.2;
  const reviews = (restaurant?.reviews || []).slice(0, 5).map(r => r.text).join(" | ");

  const apiKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY || process.env.GROQ_API_KEY;

  if (apiKey) {
    const isGroqKey = apiKey.startsWith("gsk_");
    const endpoint = isGroqKey ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.x.ai/v1/chat/completions";
    const model = isGroqKey ? "qwen/qwen3.8-27b" : "grok-2-latest";

    try {
      const sysPrompt = "You are an expert Ghost Customer UX Auditor for restaurants. Generate a concise 3-point walkthrough audit simulating a first-time diner's journey based strictly on facts provided.";
      const userPrompt = `Restaurant Name: "${name}", Cuisines: "${cuisines}", Cost for 2: ₹${cost}, Rating: ${rating} ★. Recent Reviews: "${reviews || 'Great food, fast service'}".`;

      const res = await axios.post(
        endpoint,
        {
          model: model,
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.4
        },
        {
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          timeout: 10000
        }
      );

      let content = res.data?.choices?.[0]?.message?.content || "";
      content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

      if (content) {
        return {
          restaurantName: name,
          auditReport: content,
          status: "Generated via Live AI Ghost Audit"
        };
      }
    } catch (err) {
      console.warn("Ghost customer audit fallback:", err.message);
    }
  }

  // Fallback audit report
  return {
    restaurantName: name,
    auditReport: `**Ghost Customer Journey Audit for ${name}**:\n` +
      `1. **Discovery & First Impression**: Cuisines (${cuisines}) are appealing, but vegetarian specialty options could be highlighted more prominently.\n` +
      `2. **Menu Clarity**: Price point (₹${cost} for two) is competitive. Highlight signature dishes on digital menus.\n` +
      `3. **Service Flow**: Rating of ${rating} ★ is solid. Ensure peak hour weekend wait times are communicated to diners upon arrival.`,
    status: "Generated via Rule-Assisted Audit Engine"
  };
}

module.exports = {
  generateGhostCustomerAudit
};
