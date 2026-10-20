const mongoose = require('mongoose');
async function run() {
  await mongoose.connect('mongodb://localhost:27017/dinescout');
  const Restaurant = mongoose.model('Restaurant', new mongoose.Schema({}, { strict: false }), 'restaurants');
  const blrQuery = {
    $or: [
      { city: /bengaluru|bangalore/i },
      { locality: /bengaluru|bangalore/i },
      { locality: /koramangala|indiranagar|marathahalli|whitefield|hsr|mg road|brigade|residency/i }
    ]
  };
  const blr = await Restaurant.find(blrQuery);
  const bad = blr.filter(r => !parseFloat(r.latitude) || !parseFloat(r.longitude) || isNaN(parseFloat(r.latitude)));
  for (let r of bad) {
    console.log('Fixing coordinates for: ' + r.name + ' - ' + r.locality);
    await Restaurant.updateOne({ _id: r._id }, { $set: { latitude: 12.9716, longitude: 77.5946 } });
  }
  process.exit(0);
}
run();
