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
  console.log('Found ' + blr.length + ' Bangalore restaurants to update.');
  
  const samplePhotos = [
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=600&q=80'
  ];
  
  let updated = 0;
  for (let i=0; i<blr.length; i++) {
    let r = blr[i];
    let photo = samplePhotos[i % samplePhotos.length];
    await Restaurant.updateOne({ _id: r._id }, { $set: { photoUrl: photo, featured_image: photo } });
    updated++;
  }
  console.log('Updated ' + updated + ' restaurants.');
  process.exit(0);
}
run();
