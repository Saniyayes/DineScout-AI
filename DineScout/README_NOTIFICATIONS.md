# DineScout: Owner -> User Smart Notification System

## Features
- **Real-Time Delivery (SSE)**: Notifications dispatched by owners are immediately sent to active users in real-time.
- **AI Smart Notify**:
  - **Magic Writer**: Generates 3 polished variants from a rough idea.
  - **Predictive Time**: Suggests the best time to send.
  - **Audience Reach Analysis**: Estimates how many users will receive the notification.
  - **Live Scoring**: Scores the message impact and provides tips as the owner types.
- **Engagement Analytics**: Owners can view their history and stats on delivered and read rates.

## Setup and Testing

1. **Install Dependencies**:
   Ensure you have installed the new dependencies:
   ```bash
   cd backend
   npm install node-cron
   ```

2. **Database Models**:
   The new models (`Notification.js`, `UserNotification.js`, and `NotificationPreference.js`) will automatically map to MongoDB when the server boots.

3. **Seeding Demo Data**:
   To test the frontend UI immediately with some data, run the seed script:
   ```bash
   cd backend
   node seed_notifications.js
   ```
   *(Note: You must have at least 1 registered user and 1 owner in the database for this to work).*

4. **Testing End-to-End**:
   1. Start your backend server (`npm start`).
   2. Open **two browser tabs**:
      - Tab A (User Portal): Login as a standard user. You should see a red bell icon in the top right. Click it to view the seeded notifications.
      - Tab B (Owner Portal): Login as an owner. Click "Smart Notifications" in the top bar.
   3. **Dispatch a Live Notification**:
      - In the Owner Portal (Tab B), type a Message Idea (e.g., "Flash sale on desserts").
      - Click "AI Magic Writer" to generate variants.
      - Pick a title, refine the message, and click **Dispatch Notification**.
   4. **Observe Real-Time Arrival**:
      - Switch immediately to the User Portal (Tab A).
      - You will see a live toast notification popup in the bottom right corner, and the notification bell count will increase automatically!
