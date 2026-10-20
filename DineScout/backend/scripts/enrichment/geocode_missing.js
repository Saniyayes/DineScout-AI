const mongoose = require('mongoose');
const axios = require('axios');

async function geocodeMissing() {
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
    
    let updatedCount = 0;

    for (const r of restaurants) {
      const lat = parseFloat(r.latitude || r.lat);
      const lon = parseFloat(r.longitude || r.lng || r.lon);

      if (!lat || !lon || isNaN(lat) || isNaN(lon) || lat === 0 || lon === 0) {
        console.log(`Missing coordinates for: ${r.name}`);
        
        // OpenStreetMap Nominatim Free API
        const query = encodeURIComponent(`${r.name}, ${r.locality}, ${r.city || 'Bangalore'}`);
        const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
        
        try {
          // Add a simple delay to respect Nominatim limits (1 req/s)
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          const response = await axios.get(url, {
            headers: { 'User-Agent': 'DineScout-Enrichment-Script' }
          });

          if (response.data && response.data.length > 0) {
            const newLat = parseFloat(response.data[0].lat);
            const newLon = parseFloat(response.data[0].lon);
            
            console.log(`Found coordinates via Nominatim: ${newLat}, ${newLon}`);
            r.latitude = newLat;
            r.longitude = newLon;
            await r.save();
            updatedCount++;
            console.log(`Updated ${r.name} in DB.`);
          } else {
            console.log(`No results found on Nominatim for query: ${query}`);
            
            // Try less specific query
            const fallbackQuery = encodeURIComponent(`${r.locality}, Bangalore`);
            const fallbackUrl = `https://nominatim.openstreetmap.org/search?q=${fallbackQuery}&format=json&limit=1`;
            
            await new Promise(resolve => setTimeout(resolve, 1500));
            const fallbackResponse = await axios.get(fallbackUrl, {
              headers: { 'User-Agent': 'DineScout-Enrichment-Script' }
            });
            
            if (fallbackResponse.data && fallbackResponse.data.length > 0) {
              const fLat = parseFloat(fallbackResponse.data[0].lat);
              const fLon = parseFloat(fallbackResponse.data[0].lon);
              console.log(`Found fallback locality coordinates: ${fLat}, ${fLon}`);
              r.latitude = fLat;
              r.longitude = fLon;
              await r.save();
              updatedCount++;
              console.log(`Updated ${r.name} with fallback coords.`);
            } else {
               console.log('Fallback geocoding also failed.');
            }
          }
        } catch (apiErr) {
          console.error(`Geocoding API error for ${r.name}:`, apiErr.message);
        }
      }
    }

    console.log(`\nGeocoding complete. Updated ${updatedCount} restaurants.`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

geocodeMissing();
