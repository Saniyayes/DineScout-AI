const clients = new Map(); // userId -> response object

const addClient = (userId, res) => {
  clients.set(userId.toString(), res);
};

const removeClient = (userId) => {
  clients.delete(userId.toString());
};

const sendNotificationToUser = (userId, notification) => {
  const res = clients.get(userId.toString());
  if (res) {
    res.write(`data: ${JSON.stringify(notification)}\n\n`);
  }
};

const sendNotificationToMultiple = (userIds, notification) => {
  userIds.forEach(id => sendNotificationToUser(id, notification));
};

const broadcast = (notification) => {
  clients.forEach((res) => {
    try {
      res.write(`data: ${JSON.stringify(notification)}\n\n`);
    } catch (e) {}
  });
};

module.exports = {
  addClient,
  removeClient,
  sendNotificationToUser,
  sendNotificationToMultiple,
  broadcast
};
