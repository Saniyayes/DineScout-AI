const mongoose = require("mongoose");
const Restaurant = require("./models/Restaurant");

// Haversine Distance Calculation in KM
function getDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Earth radius in KM
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

// User location center (e.g. MG Road / Central Bengaluru: 12.9716, 77.5946)
const USER_LAT = 12.9716;
const USER_LON = 77.5946;

async function getNearLocations() {
  await mongoose.connect("mongodb://127.0.0.1:27017/dinescout");

  const restaurants = await Restaurant.find({
    $or: [
      { city: { $regex: "bengaluru|bangalore", $options: "i" } },
      { locality: { $regex: "koramangala|indiranagar|residency|mg road|marathahalli", $options: "i" } }
    ]
  });

  const formatted = restaurants.map(r => {
    let lat = r.latitude ? parseFloat(r.latitude) : 12.9756;
    let lon = r.longitude ? parseFloat(r.longitude) : 77.6066;

    if (r.locality && r.locality.toLowerCase().includes("koramangala")) {
      lat = 12.9352; lon = 77.6245;
    } else if (r.locality && r.locality.toLowerCase().includes("indiranagar")) {
      lat = 12.9784; lon = 77.6408;
    } else if (r.locality && r.locality.toLowerCase().includes("marathahalli")) {
      lat = 12.9569; lon = 77.7011;
    }

    const dist = getDistance(USER_LAT, USER_LON, lat, lon);

    return {
      name: r.name,
      locality: r.locality || "Central Bengaluru",
      address: r.address || "Bengaluru",
      rating: r.rating || 4.0,
      cost: r.cost || 800,
      cuisines: r.cuisines || "Multi-Cuisine",
      distanceKm: dist
    };
  });

  formatted.sort((a, b) => a.distanceKm - b.distanceKm);

  console.log("=== TOP NEARBY LOCATIONS SUMMARY ===");
  console.log(JSON.stringify(formatted.slice(0, 15), null, 2));

  await mongoose.disconnect();
}

getNearLocations();
