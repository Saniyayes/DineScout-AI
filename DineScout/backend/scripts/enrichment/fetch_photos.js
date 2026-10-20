require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

async function fetchPhotos() {
  if (!API_KEY) {
    console.error("ERROR: GOOGLE_PLACES_API_KEY is missing from environment variables.");
    process.exit(1);
  }

  try {
    await mongoose.connect('mongodb://localhost:27017/dinescout');
    console.log('Connected to MongoDB');

    const Restaurant = require('../../models/Restaurant');

    const blrQuery = {
      $or: [
        { city: /bengaluru|bangalore/i },
        { locality: /bengaluru|bangalore/i },
        { locality: /koramangala|indiranagar|marathahalli|whitefield|hsr|mg road|brigade|residency/i }
      ]
    };

    const restaurants = await Restaurant.find(blrQuery);
    
    // Filter out Gurgaon from mg road matches
    const blrRestaurants = restaurants.filter(r => {
      const loc = (r.locality + " " + r.city).toLowerCase();
      return !loc.includes("gurgaon") && !loc.includes("delhi") && !loc.includes("noida");
    });

    console.log(`Processing ${blrRestaurants.length} Bangalore restaurants for photos...`);

    let updatedCount = 0;
    let notFoundCount = 0;

    for (const r of blrRestaurants) {
      if (r.photos && r.photos.length > 0) {
        console.log(`Skipping ${r.name}, already has photos.`);
        continue;
      }

      const query = encodeURIComponent(`${r.name} ${r.locality} Bangalore`);
      const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=place_id,photos&key=${API_KEY}`;

      try {
        const res = await axios.get(searchUrl);
        
        if (res.data.status === 'OK' && res.data.candidates && res.data.candidates.length > 0) {
          const candidate = res.data.candidates[0];
          
          if (candidate.photos && candidate.photos.length > 0) {
            const photoRefs = candidate.photos.slice(0, 3);
            const newPhotos = photoRefs.map(p => ({
              url: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${p.photo_reference}&key=${API_KEY}`,
              attribution: p.html_attributions && p.html_attributions.length > 0 ? p.html_attributions[0] : ''
            }));
            
            r.photos = newPhotos;
            await r.save();
            updatedCount++;
            console.log(`✅ Fetched ${newPhotos.length} photos for ${r.name}`);
          } else {
            console.log(`⚠️  No photos found for matched place: ${r.name}`);
            notFoundCount++;
          }
        } else {
           console.log(`❌ Place not found on Google for: ${r.name}`);
           notFoundCount++;
        }
        
      } catch (err) {
        console.error(`API Error for ${r.name}:`, err.message);
      }
    }

    console.log(`\n--- PHOTO ENRICHMENT SUMMARY ---`);
    console.log(`Total restaurants processed: ${blrRestaurants.length}`);
    console.log(`Successfully enriched: ${updatedCount}`);
    console.log(`Failed / No photos: ${notFoundCount}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

fetchPhotos();
