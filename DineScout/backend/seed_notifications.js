require("dotenv").config();
const mongoose = require("mongoose");
const Notification = require("./models/Notification");
const UserNotification = require("./models/UserNotification");
const User = require("./models/User");

mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/dinescout").then(async () => {
  console.log("Connected to MongoDB for seeding notifications.");

  try {
    // Clear old data
    await Notification.deleteMany({});
    await UserNotification.deleteMany({});

    // Find a user and an owner
    const user = await User.findOne({ role: "user" });
    const owner = await User.findOne({ role: "owner" });

    if (!user || !owner) {
      console.log("Please make sure you have at least 1 user and 1 owner in the database to seed notifications.");
      process.exit(1);
    }

    const n1 = new Notification({
      ownerId: owner._id,
      title: "Weekend Biryani Bonanza! 🍛",
      message: "Get 20% off on our signature biryani this weekend. Don't miss out!",
      type: "Offer",
      status: "Sent",
      stats: { delivered: 1, read: 0, clicked: 0 }
    });
    await n1.save();

    const n2 = new Notification({
      ownerId: owner._id,
      title: "Live Music Night 🎸",
      message: "Join us this Friday for a live acoustic set by local bands.",
      type: "Event",
      status: "Sent",
      stats: { delivered: 1, read: 0, clicked: 0 }
    });
    await n2.save();

    const un1 = new UserNotification({
      userId: user._id,
      notificationId: n1._id,
      isRead: false
    });
    await un1.save();

    const un2 = new UserNotification({
      userId: user._id,
      notificationId: n2._id,
      isRead: false
    });
    await un2.save();

    console.log("Seed complete: Created 2 notifications for", user.email);
  } catch (err) {
    console.error("Seed error:", err);
  }
  process.exit(0);
});
