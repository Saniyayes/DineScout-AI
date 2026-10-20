const express = require("express");
const router = express.Router();
const Restaurant = require("../models/Restaurant");

// GET /api/location/opportunity
router.get("/opportunity", async (req, res) => {
  try {
    const { city, cuisine, cost } = req.query;
    if (!city) return res.status(400).json({ error: "City is required" });

    // Fallback coordinates if DB coordinates are missing/invalid
    const fallbackCoords = {
      // New Delhi Localities
      "Connaught Place": { lat: 28.6315, lon: 77.2167 },
      "Hauz Khas": { lat: 28.5494, lon: 77.2001 },
      "Rajouri Garden": { lat: 28.6415, lon: 77.1198 },
      "Saket": { lat: 28.5246, lon: 77.2066 },
      "Vasant Kunj": { lat: 28.5293, lon: 77.1531 },
      "Greater Kailash": { lat: 28.5492, lon: 77.2389 },
      "Karol Bagh": { lat: 28.6538, lon: 77.1888 },
      "Dwarka": { lat: 28.5921, lon: 77.0460 },
      "Rohini": { lat: 28.7041, lon: 77.1025 },
      "Lajpat Nagar": { lat: 28.5677, lon: 77.2433 },
      
      // Bangalore Localities
      "Koramangala": { lat: 12.9352, lon: 77.6245 },
      "Indiranagar": { lat: 12.9784, lon: 77.6408 },
      "Marathahalli": { lat: 12.9569, lon: 77.7011 },
      "Whitefield": { lat: 12.9698, lon: 77.7499 },
      "HSR Layout": { lat: 12.9121, lon: 77.6446 },
      "Jayanagar": { lat: 12.9299, lon: 77.5826 },
      "MG Road": { lat: 12.9716, lon: 77.5946 },
      "Malleswaram": { lat: 13.0031, lon: 77.5643 },
      "BTM Layout": { lat: 12.9166, lon: 77.6101 }
    };

    const targetCost = Number(cost) || 800;

    // Fetch all restaurants in the city
    const query = { city: new RegExp(city, "i") };
    const restaurants = await Restaurant.find(query);

    const localityMap = {};

    restaurants.forEach(r => {
      const loc = r.locality || "Unknown";
      if (loc === "Unknown") return;

      if (!localityMap[loc]) {
        let lat = parseFloat(r.latitude);
        let lon = parseFloat(r.longitude);
        
        // Try fallback if DB coords are missing or invalid
        if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
          const matchedFallback = Object.keys(fallbackCoords).find(k => loc.toLowerCase().includes(k.toLowerCase()));
          if (matchedFallback) {
            lat = fallbackCoords[matchedFallback].lat;
            lon = fallbackCoords[matchedFallback].lon;
          } else {
            // Default center based on city
            if (city.toLowerCase().includes("delhi")) {
              lat = 28.6139; lon = 77.2090;
            } else if (city.toLowerCase().includes("bengaluru") || city.toLowerCase().includes("bangalore")) {
              lat = 12.9716; lon = 77.5946;
            } else {
              lat = 0; lon = 0; // Skip if no coords
            }
          }
        }

        localityMap[loc] = {
          name: loc,
          lat,
          lon,
          totalVotes: 0,
          totalRest: 0,
          cuisineRest: 0,
          cuisineRatings: [],
          costs: []
        };
      }

      localityMap[loc].totalRest++;
      localityMap[loc].totalVotes += (Number(r.votes) || 0);
      localityMap[loc].costs.push(Number(r.cost) || 800);

      // Cuisine specific metrics
      if (cuisine && r.cuisines && r.cuisines.toLowerCase().includes(cuisine.toLowerCase())) {
        localityMap[loc].cuisineRest++;
        localityMap[loc].cuisineRatings.push(Number(r.rating) || 0);
      }
    });

    const results = [];
    let totalCuisineRestaurants = 0;
    
    Object.values(localityMap).forEach(area => {
      totalCuisineRestaurants += area.cuisineRest;
      if (area.lat === 0 && area.lon === 0) return;
      if (area.totalRest < 3) return; // ignore very small data points
      if (area.totalVotes < 10) return; // minimum demand threshold

      const avgCost = area.costs.reduce((a, b) => a + b, 0) / area.costs.length;
      const costDiff = Math.abs(avgCost - targetCost);
      let affordabilityFit = 100 - (costDiff / targetCost * 100);
      if (affordabilityFit < 0) affordabilityFit = 0;

      // Demand score (0-100)
      // Blend overall demand and cuisine specific demand (if any)
      const overallDemand = Math.min(100, (area.totalVotes / area.totalRest) * 5);
      const demandScore = overallDemand; // Rely heavily on overall footfall to find strong generic dining spots
      
      // Competition score (0-100): High competition means saturated
      let avgCuisineRating = 0;
      if (area.cuisineRest > 0) {
        avgCuisineRating = area.cuisineRatings.reduce((a, b) => a + b, 0) / area.cuisineRest;
      }
      // If 0 competitors, competition score is 0.
      const competitionScore = Math.min(100, (area.cuisineRest * 15) + (avgCuisineRating * 10));

      // Opportunity Score = High demand + Low competition + High affordability fit
      const opportunityScore = Math.round((demandScore * 0.5) + ((100 - competitionScore) * 0.3) + (affordabilityFit * 0.2));

      results.push({
        locality: area.name,
        lat: area.lat,
        lon: area.lon,
        demandScore: Math.round(demandScore),
        competitionScore: Math.round(competitionScore),
        avgCost: Math.round(avgCost),
        opportunityScore,
        competitors: area.cuisineRest
      });
    });

    // Sort by opportunity score descending
    results.sort((a, b) => b.opportunityScore - a.opportunityScore);
    const topAreas = results.slice(0, 10);

    // AI Summary
    let summary = "Insufficient data to generate a market summary for this specific cuisine and city.";
    if (topAreas.length > 0) {
      const best = topAreas[0];
      const worst = results[results.length - 1];
      
      summary = `Based on our AI analysis, **${best.locality}** is the prime location for a new **${cuisine || 'restaurant'}** in **${city}** due to high unmet demand (Opportunity Score: **${best.opportunityScore}/100**) and an ideal price fit.`;
      if (worst && worst.locality !== best.locality) {
        summary += ` Conversely, you should avoid **${worst.locality}** as it is highly saturated with heavy competition.`;
      }
    }

    res.json({
      areas: results,
      summary,
      limitedData: cuisine && totalCuisineRestaurants < 10
    });

  } catch (err) {
    console.error("Location Opportunity Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;
