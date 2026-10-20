const Restaurant = require("../models/Restaurant");

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

/**
 * Shared nearby search logic used by both the REST API and the AI Chatbot.
 * Applies a strict geospatial bounding box (~50km) before computing Haversine distances.
 */
async function searchNearby({ lat, lon, cuisine, budget, mood, city, limit = 20, sortMode = "distance" }) {
  if (!lat || !lon) {
    throw new Error("Latitude and Longitude are required for nearby search.");
  }

  const latNum = Number(lat);
  const lonNum = Number(lon);

  let query = {};

  // Geospatial Bounding Box (~55km radius)
  query.latitude = { $gte: latNum - 0.5, $lte: latNum + 0.5 };
  query.longitude = { $gte: lonNum - 0.5, $lte: lonNum + 0.5 };

  // Filters
  if (cuisine && cuisine.trim() !== "") {
    query.$or = [
      { cuisines: { $regex: cuisine, $options: "i" } },
      { name: { $regex: cuisine, $options: "i" } }
    ];
  }
  
  if (budget && Number(budget) > 0) {
    query.cost = { $lte: Number(budget) };
  }

  if (mood && mood.trim() !== "") {
    query.moodTags = { $regex: mood, $options: "i" };
  }

  if (city && city.trim() !== "") {
    query.city = { $regex: city, $options: "i" };
  }

  // Fetch from DB (limit high to ensure enough candidates for distance sorting)
  let data = await Restaurant.find(query).limit(500);

  // If no results, try expanding the bounding box slightly or dropping city
  if (data.length === 0) {
    delete query.city;
    query.latitude = { $gte: latNum - 0.8, $lte: latNum + 0.8 }; // ~85km
    query.longitude = { $gte: lonNum - 0.8, $lte: lonNum + 0.8 };
    data = await Restaurant.find(query).limit(500);
  }

  // Map and calculate distance
  const result = data.map(r => {
    let distance = 9999;
    if (r.latitude && r.longitude) {
      distance = getDistance(latNum, lonNum, r.latitude, r.longitude);
    }

    return {
      id: r._id || r.id,
      name: r.name,
      cuisines: r.cuisines,
      rating: r.rating || 4.0,
      cost: r.cost,
      latitude: r.latitude,
      longitude: r.longitude,
      city: r.city,
      address: r.address,
      locality: r.locality,
      votes: r.votes,
      valueScore: r.valueScore || 7.0,
      valueBadge: r.valueBadge || "Good Value 👍",
      moodTags: r.moodTags || [],
      pros: r.pros || [],
      cons: r.cons || [],
      dishes: (r.dishes || []).slice(0, 3),
      photoUrl: r.photoUrl,
      distance: Number(distance.toFixed(2))
    };
  });

  // Default sorting: Distance then Rating
  result.sort((a, b) => {
    if (sortMode === "rating") {
      if (b.rating !== a.rating) return b.rating - a.rating;
      return a.distance - b.distance;
    }
    
    // Sort by distance primarily
    if (a.distance !== b.distance) {
      return a.distance - b.distance;
    }
    return b.rating - a.rating;
  });

  return result.slice(0, limit);
}

module.exports = {
  getDistance,
  searchNearby
};
