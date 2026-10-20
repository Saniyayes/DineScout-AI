/**
 * Group Budget Splitter & Venue Matcher Module
 */

const Restaurant = require("../models/Restaurant");

// In-memory group session store
const groupSessions = new Map();

function createGroupSession(hostUsername = "Host Diner") {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const session = {
    code,
    host: hostUsername,
    members: [{ username: hostUsername, maxBudget: 800, preferredCuisine: null }],
    createdAt: Date.now()
  };
  groupSessions.set(code, session);
  return session;
}

function joinGroupSession(code, username, maxBudget = 600, preferredCuisine = null) {
  const codeUpper = (code || "").toUpperCase().trim();
  const session = groupSessions.get(codeUpper);
  if (!session) return null;

  // Add or update member budget
  const existingIdx = session.members.findIndex(m => m.username === username);
  if (existingIdx >= 0) {
    session.members[existingIdx] = { username, maxBudget: Number(maxBudget), preferredCuisine };
  } else {
    session.members.push({ username, maxBudget: Number(maxBudget), preferredCuisine });
  }

  return session;
}

async function findGroupVenueMatches(code) {
  const codeUpper = (code || "").toUpperCase().trim();
  const session = groupSessions.get(codeUpper);
  if (!session) return null;

  // Compute minimum individual budget among all members
  const minBudget = Math.min(...session.members.map(m => m.maxBudget));
  // Apply a 15% comfortable margin
  const maxAllowableCostForTwo = Math.round(minBudget * 1.85);

  const query = {
    cost: { $lte: maxAllowableCostForTwo }
  };

  const restaurants = await Restaurant.find(query).sort({ rating: -1, votes: -1 }).limit(10);

  return {
    sessionCode: codeUpper,
    totalMembers: session.members.length,
    memberBudgets: session.members,
    lowestMemberBudget: minBudget,
    maxAllowableCostForTwo,
    matches: restaurants.map(r => ({
      id: r._id,
      name: r.name,
      rating: r.rating,
      cost: r.cost,
      cuisines: r.cuisines,
      city: r.city,
      locality: r.locality,
      groupComfortBadge: `Satisfies all ${session.members.length} member budgets (under ₹${minBudget} / person)`
    }))
  };
}

module.exports = {
  createGroupSession,
  joinGroupSession,
  findGroupVenueMatches,
  groupSessions
};
