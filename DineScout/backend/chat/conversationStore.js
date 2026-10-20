// Short-term in-memory conversation context store
const sessions = new Map();

// Clean up expired sessions (older than 2 hours)
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.lastActive > 2 * 60 * 60 * 1000) {
      sessions.delete(id);
    }
  }
}, 30 * 60 * 1000);

function getSession(sessionId) {
  if (!sessionId) return null;
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      sessionId,
      lastFilters: {},
      lastRestaurants: [],
      lastTopic: null,
      userRole: "user",
      createdAt: Date.now(),
      lastActive: Date.now()
    });
  }
  const session = sessions.get(sessionId);
  session.lastActive = Date.now();
  return session;
}

function updateSession(sessionId, updates) {
  const session = getSession(sessionId);
  if (!session) return null;

  if (updates.lastFilters) {
    session.lastFilters = { ...session.lastFilters, ...updates.lastFilters };
  }
  if (updates.lastRestaurants) {
    session.lastRestaurants = updates.lastRestaurants;
  }
  if (updates.lastTopic !== undefined) {
    session.lastTopic = updates.lastTopic;
  }
  if (updates.userRole) {
    session.userRole = updates.userRole;
  }
  session.lastActive = Date.now();
  return session;
}

function clearSession(sessionId) {
  return sessions.delete(sessionId);
}

module.exports = {
  getSession,
  updateSession,
  clearSession
};
