const mongoose = require('mongoose');

async function checkBangaloreCoverage() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/dinescout');
    console.log('Connected to MongoDB');

    // Define a flexible schema to read whatever is there
    const Restaurant = mongoose.models.Restaurant || mongoose.model('Restaurant', new mongoose.Schema({}, { strict: false }), 'restaurants');

    // 1. Total Restaurants
    const totalCount = await Restaurant.countDocuments();
    console.log(`\nTotal restaurants in database: ${totalCount}`);

    // 2. Bangalore Restaurants
    const blrQuery = {
      $or: [
        { city: /bengaluru|bangalore/i },
        { locality: /bengaluru|bangalore/i },
        // Also check localities we know are in Bangalore just in case city is missing
        { locality: /koramangala|indiranagar|marathahalli|whitefield|hsr|mg road|brigade|residency/i }
      ]
    };
    const blrRestaurants = await Restaurant.find(blrQuery);
    console.log(`Total Bangalore restaurants found: ${blrRestaurants.length}`);

    // 3. Location Data Quality (lat/long)
    let validCoords = 0;
    let missingCoords = 0;

    blrRestaurants.forEach(r => {
      const lat = parseFloat(r.latitude || r.lat);
      const lon = parseFloat(r.longitude || r.lng || r.lon);
      if (lat && lon && !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
        validCoords++;
      } else {
        missingCoords++;
      }
    });
    console.log(`\n--- Geocoding Needs ---`);
    console.log(`Bangalore restaurants WITH valid coordinates: ${validCoords}`);
    console.log(`Bangalore restaurants MISSING/INVALID coordinates: ${missingCoords}`);

    // 4. Photo Data Quality
    let withPhotos = 0;
    let withoutPhotos = 0;

    blrRestaurants.forEach(r => {
      // Check common photo fields
      const hasPhoto = (r.photos && r.photos.length > 0) || r.photoUrl || r.image_url || r.featured_image;
      if (hasPhoto) {
        withPhotos++;
      } else {
        withoutPhotos++;
      }
    });
    
    console.log(`\n--- Photo Enrichment Needs ---`);
    console.log(`Bangalore restaurants WITH existing photos: ${withPhotos}`);
    console.log(`Bangalore restaurants MISSING photos: ${withoutPhotos}`);

    // Look at a sample of the first few to see the structure
    if (blrRestaurants.length > 0) {
      console.log(`\n--- Sample Restaurant Document Keys ---`);
      console.log(Object.keys(blrRestaurants[0].toObject()));
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

checkBangaloreCoverage();
