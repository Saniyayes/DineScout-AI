
const Restaurant = require("../models/Restaurant");

// Haversine Distance Helper (KM)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;

  return Number(
    (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2)
  );
}

async function searchNearby({
  lat,
  lon,
  cuisine,
  budget,
  mood,
  city,
  limit = 20,
  sortMode = "distance"
}) {
  if (lat === undefined || lon === undefined ||
      !Number.isFinite(Number(lat)) ||
      !Number.isFinite(Number(lon))) {
    throw new Error("Valid Latitude and Longitude are required.");
  }

  const latNum = Number(lat);
  const lonNum = Number(lon);

  const filters = {};

  if (cuisine && cuisine.trim()) {
    filters.$or = [
      { cuisines: { $regex: cuisine.trim(), $options: "i" } },
      { name: { $regex: cuisine.trim(), $options: "i" } }
    ];
  }

  if (budget && Number(budget) > 0) {
    filters.cost = { $lte: Number(budget) };
  }

  if (mood && mood.trim()) {
    filters.moodTags = { $regex: mood.trim(), $options: "i" };
  }

  if (city && city.trim()) {
    filters.city = { $regex: city.trim(), $options: "i" };
  }

  // Expand radius when fewer than the requested number are found.
  const radii = [0.5, 0.8, 1.2, 1.8];
  let data = [];

  for (const radius of radii) {
    const query = {
      ...filters,
      latitude: {
        $gte: latNum - radius,
        $lte: latNum + radius
      },
      longitude: {
        $gte: lonNum - radius,
        $lte: lonNum + radius
      }
    };

    data = await Restaurant.find(query).limit(1000);

    console.log(
      `Search radius: ${radius} degrees | Results: ${data.length}`
    );

    if (data.length >= limit) break;
  }

  const result = data.map(r => {
    const distance = getDistance(
      latNum,
      lonNum,
      r.latitude,
      r.longitude
    );

    return {
      id: r._id,
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
      distance
    };
  });

  result.sort((a, b) => {
    if (sortMode === "rating") {
      return b.rating - a.rating || a.distance - b.distance;
    }

    return a.distance - b.distance || b.rating - a.rating;
  });

  return result.slice(0, limit);
}

module.exports = {
  getDistance,
  searchNearby
};
