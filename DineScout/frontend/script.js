const API_BASE_URL = "https://dinescout-ai.onrender.com";
var userLat = window.userLat || null;
var userLon = window.userLon || null;
var userCity = window.userCity || null;

// ================= AUTH GUARD & LOGOUT =================
function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("username");
  localStorage.setItem("manual_logout", "true");
  window.location.href = "login.html";
}

// ================= TAB SWITCHING =================
function switchTab(tab) {
  const tabs = ["mood", "location", "dishes", "saved", "offers"];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-${t}`);
    const panel = document.getElementById(`panel-${t}`);
    if (btn) btn.classList.toggle("active", t === tab);
    if (panel) panel.style.display = t === tab ? "block" : "none";
  });

  const heroSearch = document.getElementById("hero-search-capsule");
  const feedToolbar = document.getElementById("feed-toolbar");
  const mapContainer = document.getElementById("interactive-map-container");

  if (tab === "mood") {
    if (heroSearch) heroSearch.style.display = "block";
    if (feedToolbar) feedToolbar.style.display = "flex";
    if (currentRestaurantsList && currentRestaurantsList.length > 0) {
      renderCardsOnly(currentRestaurantsList);
    } else {
      loadTrendingOnStart();
    }
  } else {
    if (heroSearch) heroSearch.style.display = "none";
    if (mapContainer) mapContainer.style.display = "none";
    if (feedToolbar) feedToolbar.style.display = (tab === "location") ? "flex" : "none";

    const resultDiv = document.getElementById("results");
    if (resultDiv) resultDiv.innerHTML = "";

    if (tab === "location") {
      getLocation();
    } else if (tab === "dishes") {
      loadDishRecommendations();
    } else if (tab === "saved") {
      loadFavorites();
    } else if (tab === "offers") {
      loadOffers();
    }
  }
}

// ================= FEATURE 1: MOOD & OCCASION SEARCH =================
function selectMoodChip(chipText) {
  const input = document.getElementById("mood-query");
  if (input) {
    input.value = chipText;
    searchByMood();
  }
}

async function searchByMood() {
  const queryInput = document.getElementById("mood-query");
  const query = queryInput ? queryInput.value.trim() : "";
  const budget = document.getElementById("mood-budget") ? document.getElementById("mood-budget").value.trim() : "";
  const localitySelect = document.getElementById("mood-locality");
  const locality = localitySelect ? localitySelect.value.trim() : "";
  const token = localStorage.getItem("token");
  const resultDiv = document.getElementById("results");

  if (!query && !locality) {
    loadTrendingOnStart();
    return;
  }

  const effectiveQuery = query || "trending popular restaurants";

  resultDiv.innerHTML = `
    <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
      <div style="font-size: 26px; margin-bottom: 8px;">✨ Analyzing vibes and matching top tables...</div>
      <p style="font-size: 14px;">Evaluating authentic diner reviews, value scores, and real-time distance</p>
    </div>
  `;

  try {
    const lat = userLat || 12.9716;
    const lon = userLon || 77.5946;
    let url = `https://dinescout-ai.onrender.com/api/restaurants/mood-search?query=${encodeURIComponent(effectiveQuery + (locality ? ' ' + locality : ''))}&lat=${lat}&lon=${lon}`;

if (budget) url += `&budget=${budget}`;

    const res = await fetch(url, {
      headers: { Authorization: token }
    });

    if (res.status === 401) {
      alert("Session expired. Please login again.");
      logout();
      return;
    }

    if (!res.ok) throw new Error("Search failed");
    const data = await res.json();
    showResults(data.results || [], `✨ Matched Vibe: "${effectiveQuery}" ${locality ? '(' + locality + ')' : ''}`);
  } catch (err) {
    console.error("Mood search error:", err);
    resultDiv.innerHTML = `<p style="grid-column: 1/-1; text-align:center; color:#ef4444; padding:30px;">Error finding restaurants for this mood. Please try again.</p>`;
  }
}

// ================= REAL DEVICE GEOLOCATION =================
function initRealLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        userLat = pos.coords.latitude;
        userLon = pos.coords.longitude;
        console.log("Real Device Location acquired:", userLat, userLon);
      },
      err => {
        console.warn("Geolocation denied/unavailable. Using IP Geolocation...");
        fetchIPLocation();
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  } else {
    fetchIPLocation();
  }
}

function fetchIPLocation() {
  // Hardcoded to Kengeri, Bangalore as requested by user
  userLat = 12.9177;
  userLon = 77.4820;
  userCity = "Bangalore";
  console.log("Forced Location to Kengeri:", userCity, userLat, userLon);
}

// Fetch IP location silently on load
fetchIPLocation();

// ================= LOCATION SEARCH =================
function getLocation() {
  if (userLat && userLon) {
    searchRestaurants();
  } else {
    fetchIPLocation();
    setTimeout(searchRestaurants, 800);
  }
}

function searchRestaurants() {
  const cuisine = document.getElementById("cuisine").value.trim();
  const budget = document.getElementById("budget").value.trim();
  const token = localStorage.getItem("token");
  const resultDiv = document.getElementById("results");

  resultDiv.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #64748b;">Searching nearby places...</div>`;

  const lat = userLat || 12.9716;
  const lon = userLon || 77.5946;
  fetch(
  `${API_BASE_URL}/api/restaurants/search?cuisine=${encodeURIComponent(cuisine)}&budget=${budget || 99999}&lat=${lat}&lon=${lon}`,
  {
    headers: { Authorization: token }
  }
)

    .then(res => {
      if (res.status === 401) {
        alert("Session expired");
        logout();
        return;
      }
      if (!res.ok) throw new Error("Server error");
      return res.json();
    })
    .then(data => {
      showResults(data, `Nearby Restaurants for "${cuisine || 'All Cuisines'}"`);
    })
    .catch(err => {
      console.error(err);
      resultDiv.innerHTML = "<p style='grid-column: 1/-1; text-align:center; color:red'>Server error. Try again.</p>";
    });
}

// ================= RESTAURANT IMAGE SUPPLIER =================
function getRestaurantImage(cuisinesStr, idStr) {
  const c = (cuisinesStr || "").toLowerCase();

  if (c.includes("cafe") || c.includes("coffee") || c.includes("bakery")) {
    return "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=600&q=80";
  }
  if (c.includes("italian") || c.includes("pizza") || c.includes("pasta")) {
    return "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80";
  }
  if (c.includes("chinese") || c.includes("dim sum") || c.includes("noodle") || c.includes("asian")) {
    return "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=600&q=80";
  }
  if (c.includes("indian") || c.includes("biryani") || c.includes("curry") || c.includes("mughlai")) {
    return "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=600&q=80";
  }
  if (c.includes("dessert") || c.includes("ice cream") || c.includes("cake") || c.includes("sweet")) {
    return "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80";
  }
  if (c.includes("burger") || c.includes("fast food") || c.includes("fries")) {
    return "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80";
  }
  if (c.includes("japanese") || c.includes("sushi") || c.includes("ramen") || c.includes("korean")) {
    return "https://images.unsplash.com/photo-1611143669185-af224c5e3252?auto=format&fit=crop&w=600&q=80";
  }
  if (c.includes("bar") || c.includes("pub") || c.includes("cocktail")) {
    return "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=600&q=80";
  }
  if (c.includes("mexican") || c.includes("taco") || c.includes("burrito")) {
    return "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=600&q=80";
  }

  const defaultImages = [
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=600&q=80"
  ];
  const charCode = (idStr || "a").charCodeAt(0) + (idStr || "a").length;
  return defaultImages[charCode % defaultImages.length];
}

// ================= SHOW RESTAURANT CARDS (Features 1, 2, 3) =================
let leafletMap = null;
let leafletMarkersGroup = null;

function getLocalityCoords(localityStr = "", cityStr = "") {
  const loc = (localityStr + " " + cityStr).toLowerCase();
  if (loc.includes("koramangala")) return { lat: 12.9352, lon: 77.6245 };
  if (loc.includes("indiranagar")) return { lat: 12.9784, lon: 77.6408 };
  if (loc.includes("marathahalli")) return { lat: 12.9569, lon: 77.7011 };
  if (loc.includes("whitefield")) return { lat: 12.9698, lon: 77.7500 };
  if (loc.includes("hsr")) return { lat: 12.9121, lon: 77.6446 };
  if (loc.includes("mg road") || loc.includes("brigade") || loc.includes("residency")) return { lat: 12.9756, lon: 77.6066 };
  if (loc.includes("gurgaon") || loc.includes("gurugram")) return { lat: 28.4595, lon: 77.0266 };
  if (loc.includes("delhi")) return { lat: 28.6139, lon: 77.2090 };
  if (loc.includes("mumbai")) return { lat: 19.0760, lon: 72.8777 };
  if (loc.includes("kengeri")) return { lat: 12.9177, lon: 77.4820 };
  return { lat: 12.9716, lon: 77.5946 }; // Default Bengaluru Center
}

function renderInteractiveMap(restaurants) {
  const mapContainer = document.getElementById("interactive-map-container");
  const counterSpan = document.getElementById("map-counter");
  if (!mapContainer || !window.L) return;

  const validRestaurants = (restaurants || []).filter(r => r && (r.name || r._id));
  if (validRestaurants.length === 0) {
    mapContainer.style.display = "none";
    return;
  }

  mapContainer.style.display = "block";
  if (counterSpan) counterSpan.innerText = `${validRestaurants.length} Places Pinpointed`;

  // Initialize Leaflet map if not created yet
  if (!leafletMap) {
    leafletMap = L.map('map', { scrollWheelZoom: false }).setView([12.9716, 77.5946], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(leafletMap);
    leafletMarkersGroup = L.layerGroup().addTo(leafletMap);
  } else {
    leafletMarkersGroup.clearLayers();
  }

  const bounds = [];

  validRestaurants.forEach(r => {
    let rLat = r.latitude ? parseFloat(r.latitude) : null;
    let rLon = r.longitude ? parseFloat(r.longitude) : null;

    if (!rLat || !rLon || isNaN(rLat) || isNaN(rLon) || rLat === 0) {
      const defaults = getLocalityCoords(r.locality, r.city);
      rLat = defaults.lat + (Math.random() - 0.5) * 0.015;
      rLon = defaults.lon + (Math.random() - 0.5) * 0.015;
    }

    const mapLink = (r.latitude && r.longitude && !isNaN(r.latitude) && parseFloat(r.latitude) !== 0)
      ? `https://www.google.com/maps/dir/?api=1&destination=${r.latitude},${r.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name + ' ' + (r.locality || '') + ' ' + (r.city || 'Bangalore'))}`;

    const popupHtml = `
      <div style="font-family: 'Plus Jakarta Sans', sans-serif; padding: 6px 4px; color: #ffffff;">
        <h4 style="margin: 0 0 4px; font-size: 14.5px; font-weight: 700; color: #ffffff;">${r.name}</h4>
        <p style="margin: 0 0 6px; font-size: 12px; color: #94a3b8;">${r.locality || r.city || 'Bangalore'} • ${r.cuisines || 'Multi-Cuisine'}</p>
        <div style="font-size: 12px; font-weight: 700; color: #4ade80; margin-bottom: 8px;">★ ${r.rating} | ₹${r.cost} for two</div>
        <a href="${mapLink}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 5px 12px; border-radius: 6px; text-decoration: none; font-size: 11px; font-weight: 700; box-shadow: 0 2px 8px rgba(249,115,22,0.4);">Directions ➔</a>
      </div>
    `;

    const marker = L.marker([rLat, rLon]).bindPopup(popupHtml);
    leafletMarkersGroup.addLayer(marker);
    bounds.push([rLat, rLon]);
  });

  if (bounds.length > 0) {
    leafletMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    setTimeout(() => { leafletMap.invalidateSize(); }, 300);
  }
}

let currentRestaurantsList = [];
let isMapVisible = false;

function toggleMapVisibility() {
  const mapContainer = document.getElementById("interactive-map-container");
  const btn = document.getElementById("btn-toggle-map");
  if (!mapContainer) return;
  isMapVisible = !isMapVisible;
  mapContainer.style.display = isMapVisible ? "block" : "none";
  if (btn) btn.innerText = isMapVisible ? "🗺️ Hide Map" : "🗺️ Toggle Map";
  if (isMapVisible && leafletMap) {
    setTimeout(() => { leafletMap.invalidateSize(); }, 300);
  }
}

function filterCurrentResults(filterType) {
  ["all", "rating", "budget", "luxury"].forEach(f => {
    const p = document.getElementById(`pill-${f}`);
    if (p) p.classList.toggle("active", f === filterType);
  });

  if (!currentRestaurantsList || currentRestaurantsList.length === 0) return;

  let filtered = [...currentRestaurantsList];
  if (filterType === "rating") {
    filtered = filtered.filter(r => (Number(r.rating) || 0) >= 4.2);
  } else if (filterType === "budget") {
    filtered = filtered.filter(r => (Number(r.cost) || 0) <= 1000);
  } else if (filterType === "luxury") {
    filtered = filtered.filter(r => (Number(r.cost) || 0) >= 1500 || (r.cuisines || "").toLowerCase().includes("fine dining") || (r.cuisines || "").toLowerCase().includes("luxury"));
  }
  renderCardsOnly(filtered);
}

function showResults(data, headerText) {
  currentRestaurantsList = data || [];

  const feedToolbar = document.getElementById("feed-toolbar");
  if (feedToolbar) feedToolbar.style.display = "flex";

  const mainTitle = document.getElementById("feed-main-title");
  const subTitle = document.getElementById("feed-sub-title");
  if (mainTitle && headerText) mainTitle.innerHTML = headerText;
  if (subTitle && data) subTitle.innerText = `${data.length} destinations ranked by authentic diner sentiment, verified reviews, and value scores`;

  // Reset filters to 'all'
  ["all", "rating", "budget", "luxury"].forEach(f => {
    const p = document.getElementById(`pill-${f}`);
    if (p) p.classList.toggle("active", f === "all");
  });

  renderCardsOnly(data);
}

function renderCardsOnly(data) {
  const div = document.getElementById("results");
  if (!div) return;
  div.innerHTML = "";

  if (!data || data.length === 0) {
    div.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 50px 20px; color: var(--text-muted); background: var(--card-bg); border-radius: 18px; border: 1px dashed var(--border-color);">
        <div style="font-size: 32px; margin-bottom: 10px;">🍽️</div>
        <h4 style="font-size: 18px; color: var(--text-title); margin-bottom: 6px;">No spots matched this filter</h4>
        <p style="font-size: 13.5px;">Try loosening your budget or switching to 'All Places' above.</p>
        <button class="search-btn-cta" onclick="filterCurrentResults('all')" style="margin-top: 14px; padding: 8px 18px; font-size: 13px;">Show All Results</button>
      </div>
    `;
    const mc = document.getElementById("interactive-map-container");
    if (mc) mc.style.display = "none";
    return;
  }

  // Render Interactive Leaflet Map with real Bangalore markers
  renderInteractiveMap(data);

  data.forEach(r => {
    const mapLink = (r.latitude && r.longitude && !isNaN(r.latitude) && parseFloat(r.latitude) !== 0)
      ? `https://www.google.com/maps/dir/?api=1&destination=${r.latitude},${r.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name + ' ' + (r.locality || '') + ' Bangalore')}`;

    // Photos
    let primaryImageUrl = getRestaurantImage(r.cuisines, r.id || r._id || r.name);
    let attributionHtml = '';

    if (r.photoUrl) {
      primaryImageUrl = r.photoUrl;
    } else if (r.photos && r.photos.length > 0 && r.photos[0].url) {
      primaryImageUrl = r.photos[0].url;
      if (r.photos[0].attribution) {
        attributionHtml = `<div style="position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.6); color: rgba(255,255,255,0.8); padding: 2px 6px; font-size: 9px; border-radius: 4px; z-index: 2;">${r.photos[0].attribution}</div>`;
      }
    }

    // Value badge styling
    let badgeClass = "value-badge";
    if ((r.valueBadge || "").includes("Exceptional")) badgeClass += " value-exceptional";
    else if ((r.valueBadge || "").includes("Great")) badgeClass += " value-great";

    const tagsHtml = (r.moodTags && r.moodTags.length > 0 ? r.moodTags : ["Popular", "Casual Dine", "Great Ambiance"]).slice(0, 3).map(t => `<span class="mood-pill">${t}</span>`).join(" ");

    const cuisineDisplay = (r.cuisines || "Multi-Cuisine").split(",").slice(0, 2).join(", ");

    div.innerHTML += `
      <div class="card">
        <div class="card-img-wrapper">
          <img src="${primaryImageUrl}" alt="${r.name}" class="card-img" onerror="this.src='https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80'" />
          ${attributionHtml}
          <div class="card-img-overlay"></div>
          <span class="cuisine-tag-top">${cuisineDisplay}</span>
          <span class="rating-badge">★ ${r.rating || 4.2}</span>
          <div class="card-img-title" style="display:flex; justify-content:space-between; align-items:flex-end;">
            <div>
              <h3>${r.name}</h3>
              <div style="font-size:12px; color:#cbd5e1; margin-top:2px; font-weight:500;">
                📍 ${r.locality || r.city || 'Bangalore'} ${r.distance && r.distance !== 'N/A' ? '• ' + r.distance + ' km' : ''}
              </div>
            </div>
            <button class="card-fav-btn" onclick="toggleFavorite('${r.id || r._id}', '${r.name.replace(/'/g, "\\'")}', '${(r.locality || '').replace(/'/g, "\\'")}', '${(r.city || '').replace(/'/g, "\\'")}', this)" title="Bookmark">
              ${userFavorites.has(r.id || r._id) ? '❤️' : '🤍'}
            </button>
          </div>
        </div>

        <div class="card-body">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <span class="${badgeClass}">${r.valueBadge || "Good Value"} (Score: ${r.valueScore || 7.5}/10)</span>
            <span style="font-size:13.5px; font-weight:700; color:var(--text-title);">₹${r.cost || 800} for two</span>
          </div>

          <div style="margin-bottom: 10px; font-size: 11.5px; font-weight: 600;">
            ${
              (r.reviewConfidenceLevel === "Low")
                ? `<span style="background: rgba(239,68,68,0.14); color: #f87171; padding: 3px 9px; border-radius: 12px; border: 1px solid rgba(239,68,68,0.3);">🚨 Review Burst Warning (Low Trust)</span>`
                : (r.reviewConfidenceLevel === "Medium")
                ? `<span style="background: rgba(245,158,11,0.14); color: #fbbf24; padding: 3px 9px; border-radius: 12px; border: 1px solid rgba(245,158,11,0.3);">⚠️ Medium Review Confidence</span>`
                : `<span style="background: rgba(16,185,129,0.14); color: #34d399; padding: 3px 9px; border-radius: 12px; border: 1px solid rgba(16,185,129,0.3);">✔️ Authentic Reviews (High Trust)</span>`
            }
            ${
              r.loyaltyBadge
                ? `<div style="margin-top: 5px; font-size: 11px; background: rgba(16,185,129,0.14); color: #34d399; padding: 3px 9px; border-radius: 10px; border: 1px solid rgba(16,185,129,0.3);">${r.loyaltyBadge}</div>`
                : ''
            }
          </div>

          <div class="tag-container">
            ${tagsHtml}
          </div>
          
          ${r.reviews && r.reviews.length > 0 ? `
          <div class="user-review-snippet">
            <b>${r.reviews[0].user || "Diner"}:</b> "${r.reviews[0].text}"
          </div>
          ` : `
          <div class="user-review-snippet">
            <b>Diner Highlight:</b> "Top-tier flavors, generous portions, and exceptional dining ambiance."
          </div>
          `}

          <div class="card-actions">
            <button class="btn-summary" onclick="openReviewSummary('${r.id || r._id}')">
              🤖 AI Verdict
            </button>
            <button class="btn-summary btn-review-toggle" onclick="toggleReviewForm('${r.id || r._id}')">
              ✍️ Review
            </button>
            <a href="${mapLink}" target="_blank" class="btn-route">
              📍 Route
            </a>
          </div>

          <!-- WRITE REVIEW FORM (Hidden by default) -->
          <div id="review-form-${r.id || r._id}" class="card-review-form" style="display:none;">
            <div style="margin-bottom:8px; display:flex; align-items:center; gap:8px;">
              <b>Rating: </b>
              <select id="review-rating-${r.id || r._id}" style="padding:5px 8px; border-radius:6px;">
                <option value="5">5 ★ - Exceptional</option>
                <option value="4">4 ★ - Very Good</option>
                <option value="3">3 ★ - Average</option>
                <option value="2">2 ★ - Mediocre</option>
                <option value="1">1 ★ - Poor</option>
              </select>
            </div>
            <textarea id="review-text-${r.id || r._id}" placeholder="Share your experience (food, vibe, service)..." rows="2" style="width:100%; margin-bottom:8px;"></textarea>
            <div style="margin-bottom:10px; display:flex; flex-wrap:wrap; gap:10px; font-size:12.5px;">
              <label style="cursor:pointer;"><input type="checkbox" id="tag-Food-${r.id || r._id}"> Food</label>
              <label style="cursor:pointer;"><input type="checkbox" id="tag-Service-${r.id || r._id}"> Service</label>
              <label style="cursor:pointer;"><input type="checkbox" id="tag-Price-${r.id || r._id}"> Price</label>
              <label style="cursor:pointer;"><input type="checkbox" id="tag-Ambiance-${r.id || r._id}"> Ambiance</label>
            </div>
            <button onclick="submitReview('${r.id || r._id}', '${r.name.replace(/'/g, "\\'")}')" class="search-btn-cta" style="padding:8px 14px; font-size:13px; width:100%;">Submit Review</button>
          </div>
        </div>
      </div>
    `;
  });
}

async function loadTrendingOnStart() {
  const token = localStorage.getItem("token");
  if (!token) return;

  const div = document.getElementById("results");
  if (div) {
    div.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
        <div style="font-size: 26px; margin-bottom: 8px;">✨ Curating Bangalore's top trending tables...</div>
        <p style="font-size: 14px;">Evaluating authentic sentiment, real-time footfall, and Michelin-tier value</p>
      </div>
    `;
  }

  try {
    const lat = userLat || 12.9716;
    const lon = userLon || 77.5946;
    const res = await fetch(
  `${API_BASE_URL}/api/restaurants/search?lat=${lat}&lon=${lon}&sortMode=rating`,
  {
    headers: { Authorization: token }
  }
);
    
    if (res.ok) {
      const data = await res.json();
      showResults(data || [], `🔥 Featured & Trending Spots in Bangalore`);
    }
  } catch (e) {
    console.error("Failed to load trending spots:", e);
  }
}


// ================= FEATURE 2: AI REVIEW SUMMARIZATION =================
async function openReviewSummary(restaurantId) {
  const modal = document.getElementById("review-modal");
  const content = document.getElementById("modal-content");
  const token = localStorage.getItem("token");

  modal.style.display = "flex";
  content.innerHTML = `
    <div style="text-align:center; padding:30px;">
      <div style="font-size:24px; margin-bottom:8px;">🤖 Synthesizing AI Review Insights...</div>
      <p style="color:#64748b;">Aggregating diner sentiment, pros & cons...</p>
    </div>
  `;

  try {
   const res = await fetch(
  `${API_BASE_URL}/api/restaurants/${restaurantId}/review-summary`,
  {
    headers: { Authorization: token }
  }
);

    if (!res.ok) throw new Error("Failed to load review summary");
    const data = await res.json();

    const prosHtml = data.summary.pros.map(p => `<li>${p}</li>`).join("");
    const consHtml = data.summary.cons.map(c => `<li>${c}</li>`).join("");

    // Load pricing trends
    let trendBadge = "";
    try {
      const trendRes = await fetch(
  `${API_BASE_URL}/api/restaurants/${restaurantId}/trends`,
  {
    headers: { Authorization: token }
  }
);
      if (trendRes.ok) {
        const trendData = await trendRes.json();
        trendBadge = `<span style="font-size:12px; background:#eff6ff; color:#1d4ed8; padding:3px 10px; border-radius:12px; border:1px solid #bfdbfe;">📈 ${trendData.summaryText}</span>`;
      }
    } catch (e) {}

    content.innerHTML = `
      <h2 style="font-size:22px; font-weight:800; color:var(--text-title); margin-bottom:6px;">${data.name}</h2>
      <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:16px;">
        <span class="rating-badge" style="position:static;">★ ${data.rating}</span>
        <span style="font-size:13px; color:var(--text-muted);">${data.votes} Total Reviews</span>
        <span class="value-badge">${data.valueBadge}</span>
        ${trendBadge}
      </div>

      <div class="sentiment-box">
        <div style="display:flex; justify-content:space-between; font-weight:600; font-size:13px; margin-bottom:8px;">
          <span style="color:#4ade80;">Positive Sentiment: ${data.summary.sentimentDistribution.positive}</span>
          <span style="color:#f87171;">Friction Points: ${data.summary.sentimentDistribution.negative}</span>
        </div>
        <div style="height:8px; background:rgba(239,68,68,0.25); border-radius:4px; overflow:hidden;">
          <div style="width:${data.summary.sentimentDistribution.positive}; height:100%; background:linear-gradient(90deg, #10b981, #22c55e);"></div>
        </div>
        <p style="font-size:13px; color:var(--text-main); margin-top:10px; line-height:1.5;"><b>AI Verdict:</b> ${data.summary.aiVerdict}</p>
      </div>

      <h4 style="font-size:14px; color:#4ade80; margin-top:14px;">✅ Key Strengths (Pros):</h4>
      <ul class="pros-list">${prosHtml}</ul>

      <h4 style="font-size:14px; color:#f87171; margin-top:14px;">⚠️ Points to Consider (Cons):</h4>
      <ul class="cons-list">${consHtml}</ul>

      <hr style="border:none; border-top:1px solid var(--border-color); margin:18px 0;" />

      <div style="background:var(--card-inner-bg); padding:16px; border-radius:14px; border:1px solid var(--border-color); margin-bottom:18px;">
        <h4 style="font-size:13.5px; color:var(--text-title); margin:0 0 6px 0;">🎙️ Submit Voice-Note Review</h4>
        <p style="font-size:12px; color:var(--text-muted); margin:0 0 10px 0;">Speak or type your voice-sourced experience. Automatic sentiment parsing applied.</p>
        <div style="display:flex; gap:8px;">
          <input type="text" id="voice-input-text" placeholder="Speak or enter voice review text..." style="flex:1; padding:10px 14px; background:var(--input-bg); color:var(--text-title); border:1px solid var(--input-border); border-radius:18px; font-size:13px; outline:none;" />
          <button onclick="submitVoiceReview('${restaurantId}')" class="btn-search" style="padding:8px 16px; border-radius:18px; font-size:12.5px;">
            Submit Voice Note
          </button>
        </div>
      </div>

      <h4 style="font-size:14px; color:var(--text-title); margin-bottom:10px;">💬 Recent Diner Feedback:</h4>
      <div style="max-height:180px; overflow-y:auto; font-size:13px; color:var(--text-main); display:flex; flex-direction:column; gap:8px;">
        ${(data.recentReviews || []).map(r => `
          <div style="background:var(--card-inner-bg); padding:12px; border-radius:10px; border:1px solid var(--border-color);">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <b style="color:var(--text-title);">${r.user} ${r.isVoiceSourced ? '<span style="font-size:10px; background:rgba(249,115,22,0.15); color:#fb923c; padding:2px 8px; border-radius:10px; border:1px solid rgba(249,115,22,0.3);">🎙️ Voice Review</span>' : ''}</b>
              <span style="color:#facc15; font-weight:700;">★ ${r.rating}</span>
            </div>
            <p style="margin:0; font-size:12.5px; color:var(--text-muted);">"${r.text}"</p>
          </div>
        `).join("")}
      </div>
    `;
  } catch (err) {
    console.error(err);
    content.innerHTML = `<p style="color:red; text-align:center;">Failed to load AI review summary.</p>`;
  }
}

async function submitVoiceReview(restaurantId) {
  const input = document.getElementById("voice-input-text");
  const text = input ? input.value.trim() : "";
  if (!text) {
    alert("Please enter or record your voice transcript text first!");
    return;
  }

  const token = localStorage.getItem("token");
  try {
    const res = await fetch(
  `${API_BASE_URL}/api/restaurants/${restaurantId}/voice-review`,
  {
    headers: { Authorization: token }
  }
);

    if (!res.ok) throw new Error("Failed to submit voice review");
    alert("Voice review submitted successfully!");
    openReviewSummary(restaurantId);
  } catch (err) {
    alert("Error submitting voice review. Please try again.");
  }
}

function closeReviewModal() {
  const modal = document.getElementById("review-modal");
  if (modal) modal.style.display = "none";
}

// ================= REALISTIC DISH PHOTOGRAPHY MAPPER =================
function getDishImageUrl(dishName = "", category = "") {
  const name = (dishName || "").toLowerCase();
  const cat = (category || "").toLowerCase();

  if (name.includes("butter chicken") || name.includes("makhani")) return "images/butter_chicken.jpg";
  if (name.includes("pizza") || name.includes("pepperoni")) return "images/pepperoni_pizza.jpg";
  if (name.includes("biryani") || name.includes("pulao")) return "images/chicken_biryani.jpg";
  if (name.includes("pasta") || name.includes("truffle") || name.includes("alfredo")) return "images/truffle_pasta.jpg";

  if (name.includes("sushi") || name.includes("nigiri") || name.includes("roll")) {
    return "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=600&q=80";
  }
  if (name.includes("dim sum") || name.includes("dumpling") || name.includes("momos")) {
    return "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=600&q=80";
  }
  if (name.includes("burger") || name.includes("sliders")) {
    return "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80";
  }
  if (name.includes("tandoori") || name.includes("tikka") || name.includes("kebab") || name.includes("chick")) {
    return "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=600&q=80";
  }
  if (name.includes("ramen") || name.includes("noodle") || name.includes("soup")) {
    return "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80";
  }
  if (name.includes("ice cream") || name.includes("dessert") || name.includes("cake") || name.includes("sweet")) {
    return "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=600&q=80";
  }
  if (name.includes("wings") || name.includes("fries") || name.includes("crispy")) {
    return "https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=600&q=80";
  }

  return "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80";
}

// ================= FEATURE 6: TOP DISHES EXPLORER =================
async function loadDishRecommendations() {
  const cuisine = document.getElementById("dish-cuisine") ? document.getElementById("dish-cuisine").value.trim() : "";
  const maxPrice = document.getElementById("dish-max-price") ? document.getElementById("dish-max-price").value.trim() : "";
  const resultDiv = document.getElementById("results");

  resultDiv.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #64748b;">Loading top rated signature dishes...</div>`;

  try {
    const city = userCity || "Bangalore";
    let url = `${API_BASE_URL}/api/restaurants/dishes/recommendations?city=${city}&`;
    //let url = `http://localhost:5000/api/restaurants/dishes/recommendations?city=${city}&`;
    if (cuisine) url += `cuisine=${encodeURIComponent(cuisine)}&`;
    if (maxPrice) url += `maxPrice=${maxPrice}&`;

    const res = await fetch(url);
    if (!res.ok) throw new Error("Dish fetch failed");
    const data = await res.json();

    if (!data.dishes || data.dishes.length === 0) {
      resultDiv.innerHTML = `<p style="grid-column: 1/-1; text-align:center; color:#64748b; padding:40px;">No signature dishes found for this filter.</p>`;
      return;
    }

    resultDiv.innerHTML = "";
    data.dishes.forEach(d => {
      const imgUrl = getDishImageUrl(d.dishName, d.category);
      const restaurantsHtml = d.topRestaurants.map(r => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--card-inner-bg); border:1px solid var(--border-subtle); padding:8px 12px; border-radius:8px; margin-top:6px; font-size:12.5px; color:var(--text-main);">
          <div>
            <b style="color:var(--text-title);">${r.name}</b> <span style="color:var(--text-muted);">(${r.city || 'Nearby'})</span>
          </div>
          <span class="rating-badge" style="position:static; font-size:11px; padding:2px 8px;">★ ${r.rating}</span>
        </div>
      `).join("");

      resultDiv.innerHTML += `
        <div class="dish-card">
          <div style="height:170px; overflow:hidden; position:relative; background:#070a13;">
            <img src="${imgUrl}" alt="${d.dishName}" style="width:100%; height:100%; object-fit:cover;" />
            <div style="position:absolute; inset:0; background:linear-gradient(to top, rgba(11,15,25,0.92) 0%, rgba(15,23,42,0.4) 60%, transparent 100%);"></div>
            <div style="position:absolute; bottom:12px; left:16px; right:16px; color:white;">
              <h4 style="font-size:18px; font-weight:700; color:white; text-shadow:0 1px 3px rgba(0,0,0,0.6); margin:0;">${d.dishName}</h4>
              <span style="font-size:11.5px; color:#cbd5e1;">${d.category || 'Specialty Dish'}</span>
            </div>
            ${d.isSignature ? '<span style="position:absolute; top:12px; right:12px; background:linear-gradient(135deg, #f97316, #ea580c); color:white; font-size:10.5px; font-weight:700; padding:4px 10px; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.4);">Signature Dish</span>' : ''}
          </div>

          <div style="padding:18px;">
            <div style="display:flex; justify-content:space-between; font-size:13.5px; font-weight:600; color:var(--text-title); margin-bottom:10px;">
              <span>Estimated: ₹${d.avgPrice}</span>
              <span style="color:#4ade80;">★ ${d.avgRating}</span>
            </div>

            <p style="font-size:12px; font-weight:700; color:var(--text-muted); margin-top:10px; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px;">Top Places Serving This:</p>
            ${restaurantsHtml}
          </div>
        </div>
      `;
    });
  } catch (err) {
    console.error("Dish error:", err);
    resultDiv.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:red;">Failed to load dish recommendations.</p>`;
  }
}

// ================= FEATURE 4: FLAVOR PROFILE DNA SEARCH =================
async function searchFlavorDNA(flavor) {
  const token = localStorage.getItem("token");
  const resultDiv = document.getElementById("results");

  resultDiv.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #64748b;">Matching ${flavor} flavor profile DNA across dishes...</div>`;

  try {
    const res = await fetch(
  `${API_BASE_URL}/api/restaurants/dishes/flavor-search?flavor=${encodeURIComponent(flavor)}`,
  {
    headers: { Authorization: token }
  }
);

    if (!res.ok) throw new Error("Flavor search failed");
    const data = await res.json();

    if (!data.dishes || data.dishes.length === 0) {
      resultDiv.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:#cbd5e1; padding:30px;">No dishes matched the "${flavor}" flavor profile.</p>`;
      return;
    }

    resultDiv.innerHTML = "";
    data.dishes.forEach(d => {
      const imgUrl = getDishImageUrl(d.dishName, d.category);
      const tagsHtml = (d.flavorTags || []).map(t => `<span style="background:#f1f5f9; color:#334155; font-size:11px; font-weight:600; padding:3px 8px; border-radius:8px; margin-right:4px;">${t}</span>`).join("");

      resultDiv.innerHTML += `
        <div class="dish-card" style="overflow:hidden; border-radius:16px; border:1px solid #e2e8f0; background:white; box-shadow:0 4px 12px rgba(0,0,0,0.05);">
          <div style="height:150px; overflow:hidden; position:relative; background:#0f172a;">
            <img src="${imgUrl}" alt="${d.dishName}" style="width:100%; height:100%; object-fit:cover;" />
            <div style="position:absolute; inset:0; background:linear-gradient(to top, rgba(15,23,42,0.85) 0%, transparent 60%);"></div>
            <div style="position:absolute; bottom:10px; left:14px; right:14px; color:white;">
              <h4 style="font-size:17px; font-weight:700; color:white; margin:0;">${d.dishName}</h4>
              <span style="font-size:11.5px; color:#cbd5e1;">${d.restaurantName} (${d.city || 'Nearby'})</span>
            </div>
            <span class="rating-badge" style="position:absolute; top:10px; right:10px; font-size:11px;">★ ${d.rating}</span>
          </div>

          <div style="padding:14px;">
            <div style="margin:6px 0 12px;">${tagsHtml}</div>

            <div style="display:flex; justify-content:space-between; align-items:center; font-size:13.5px; font-weight:600; color:#1e293b;">
              <span>Price: ₹${d.price}</span>
              <button onclick="openReviewSummary('${d.restaurantId}')" style="background:#f97316; color:white; border:none; padding:6px 12px; border-radius:12px; font-size:11.5px; font-weight:600; cursor:pointer;">
                View Restaurant
              </button>
            </div>
          </div>
        </div>
      `;
    });
  } catch (err) {
    console.error("Flavor error:", err);
    resultDiv.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:red;">Failed to load flavor recommendations.</p>`;
  }
}

// Initial trigger on page load
document.addEventListener("DOMContentLoaded", () => {
  // Pre-load default trending restaurants
  loadTrendingOnStart();
  fetchNotifications();
  initSSE();
});

// ================= NOTIFICATIONS (USER PORTAL) =================
let unreadCount = 0;
const seenNotificationIds = new Set();
let isInitialNotificationFetch = true;

function toggleNotifDropdown() {
  const dd = document.getElementById("notif-dropdown");
  dd.style.display = dd.style.display === "none" ? "block" : "none";
}

async function fetchNotifications() {
  const token = localStorage.getItem("token");
  if (!token) return;
  
  try {
    const res = await fetch(`${API_BASE_URL}/api/notifications`, {
  headers: { Authorization: token }
});
    if(res.ok) {
      const data = await res.json();

      // If new unread notification arrives after initial page load, trigger alert sound & toast
      if (!isInitialNotificationFetch && Array.isArray(data)) {
        const newUnread = data.filter(n => !n.isRead && !seenNotificationIds.has(n._id));
        newUnread.forEach(n => {
          seenNotificationIds.add(n._id);
          showToast(n.notification || {
            type: "Alert",
            title: "New Message",
            message: "You have a new restaurant update!"
          });
        });
      }

      if (Array.isArray(data)) {
        data.forEach(n => seenNotificationIds.add(n._id));
      }
      isInitialNotificationFetch = false;

      renderNotifications(data);
    }
  } catch(e) {
    console.error(e);
  }
}

// Check for new notifications periodically (fallback if SSE connection reconnects)
setInterval(fetchNotifications, 15000);

function renderNotifications(data) {
  const list = document.getElementById("notif-list");
  const badge = document.getElementById("notif-badge");
  
  if (!data || data.length === 0) {
    list.innerHTML = `<div style="padding:20px; text-align:center; color:#64748b; font-size:13px;">No notifications yet.</div>`;
    badge.style.display = "none";
    return;
  }
  
  unreadCount = data.filter(n => !n.isRead).length;
  if(unreadCount > 0) {
    badge.innerText = unreadCount;
    badge.style.display = "block";
  } else {
    badge.style.display = "none";
  }
  
  list.innerHTML = data.map(n => `
    <div style="padding: 12px 16px; border-bottom: 1px solid var(--border-color); background: ${n.isRead ? 'transparent' : 'rgba(249, 115, 22, 0.12)'}; cursor: pointer; transition: background 0.2s;" onclick="markAsRead('${n._id}', this)">
      <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
        <span style="font-size:11px; font-weight:700; color:#fb923c; text-transform:uppercase;">${n.notification?.type || 'Update'}</span>
        <span style="font-size:11px; color:var(--text-muted);">${new Date(n.createdAt).toLocaleDateString()}</span>
      </div>
      <div style="font-size:13px; font-weight:700; color:var(--text-title); margin-bottom:4px;">${n.notification?.title || 'Notification'}</div>
      <div style="font-size:12px; color:var(--text-main); line-height:1.4;">${n.notification?.message || ''}</div>
    </div>
  `).join("");
}

async function markAsRead(id, elem) {
  const token = localStorage.getItem("token");
  try {
    await fetch(`${API_BASE_URL}/api/notifications/${id}/read`, {
      method: "PATCH",
      headers: { Authorization: token }
    });
    elem.style.background = "transparent";
    unreadCount = Math.max(0, unreadCount - 1);
    const badge = document.getElementById("notif-badge");
    if(unreadCount > 0) {
      badge.innerText = unreadCount;
    } else {
      badge.style.display = "none";
    }
  } catch(e) {
    console.error(e);
  }
}

async function markAllNotifsRead() {
  const token = localStorage.getItem("token");
  try {
    await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
      method: "PATCH",
      headers: { Authorization: token }
    });
    fetchNotifications();
  } catch(e) {
    console.error(e);
  }
}

// ================= SMARTPHONE / SWIGGY PUSH MESSAGE ALERT SOUND =================
let notificationAudioContext = null;

function getAudioContext() {
  if (!notificationAudioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      notificationAudioContext = new AudioContextClass();
    }
  }
  return notificationAudioContext;
}

// Unlock audio on user interaction to comply with modern browser autoplay policies
function unlockAudio() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  const audioElement = document.getElementById("push-notification-audio");
  if (audioElement && audioElement.paused) {
    audioElement.load();
  }
}
document.addEventListener("click", unlockAudio, { passive: true });
document.addEventListener("keydown", unlockAudio, { passive: true });
document.addEventListener("touchstart", unlockAudio, { passive: true });
document.addEventListener("pointerdown", unlockAudio, { passive: true });

// Synthesizes a crisp, bright mobile message chime (Swiggy / SMS notification style)
function playSynthesizedMobileAlert() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const playAlert = () => {
      const now = ctx.currentTime;

      // Note 1: Crisp attack tone - C6 (1046.50 Hz) - Snappy phone message pop
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(1046.50, now);
      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.linearRampToValueAtTime(0.35, now + 0.008);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.12);

      // Note 2: Upbeat high sparkle - G6 (1567.98 Hz) with crystalline harmonic
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1567.98, now + 0.08);
      gain2.gain.setValueAtTime(0.001, now + 0.08);
      gain2.gain.linearRampToValueAtTime(0.4, now + 0.09);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.42);

      // Note 2 overtone: E7 (2637 Hz) shimmer for authentic phone push app feel
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = "sine";
      osc3.frequency.setValueAtTime(2637.0, now + 0.08);
      gain3.gain.setValueAtTime(0.0001, now + 0.08);
      gain3.gain.linearRampToValueAtTime(0.12, now + 0.09);
      gain3.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.08);
      osc3.stop(now + 0.35);
    };

    if (ctx.state === "suspended") {
      ctx.resume().then(playAlert).catch(playAlert);
    } else {
      playAlert();
    }
  } catch (err) {
    console.warn("Mobile alert synthesis notice:", err);
  }
}

// Plays phone message alert sound (Swiggy / Mobile Push Notification alert)
function playNotificationSound() {
  let played = false;
  try {
    const audioElement = document.getElementById("push-notification-audio");
    if (audioElement) {
      audioElement.currentTime = 0;
      const promise = audioElement.play();
      if (promise !== undefined) {
        promise.then(() => {
          played = true;
        }).catch(() => {
          // If browser policy blocked HTML5 audio, use Web Audio API immediately
          playSynthesizedMobileAlert();
        });
        return;
      }
    }
  } catch (e) {
    // Fall back to synthesis
  }
  
  if (!played) {
    playSynthesizedMobileAlert();
  }
}
window.playNotificationSound = playNotificationSound;

function initSSE() {
  const token = localStorage.getItem("token");
  if (!token) return;
  
  const source = new EventSource(`${API_BASE_URL}/api/notifications/stream?token=${token}`);
  
  source.onmessage = function(event) {
    try {
      const data = JSON.parse(event.data);
      if (data && data._id) {
        seenNotificationIds.add(data._id);
      }
      showToast(data);
      fetchNotifications();
    } catch(err) {
      console.error("SSE parse error", err);
    }
  };
  
  source.onerror = function(err) {
    console.warn("SSE connection:", err);
  };
}

function showToast(notification) {
  playNotificationSound();
  const container = document.getElementById("toast-container");
  if (!container) return;
  
  const toast = document.createElement("div");
  toast.style.background = "var(--modal-bg, #0f172a)";
  toast.style.border = "1px solid var(--border-color, rgba(255,255,255,0.15))";
  toast.style.borderLeft = "4px solid #f97316";
  toast.style.padding = "14px 18px";
  toast.style.borderRadius = "12px";
  toast.style.boxShadow = "0 10px 30px rgba(0,0,0,0.45)";
  toast.style.minWidth = "260px";
  toast.style.maxWidth = "360px";
  toast.style.backdropFilter = "blur(12px)";
  toast.style.animation = "fadein 0.3s";
  toast.style.pointerEvents = "auto";
  
  toast.innerHTML = `
    <div style="font-size: 11px; font-weight:800; color:#fb923c; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px;">${notification.type || 'Alert'}</div>
    <div style="font-size: 13.5px; font-weight:700; color:var(--text-title, #ffffff); margin-bottom:4px;">${notification.title || 'Notification'}</div>
    <div style="font-size: 12px; color:var(--text-main, #cbd5e1); line-height:1.4;">${notification.message || ''}</div>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.4s ease";
    setTimeout(() => toast.remove(), 400);
  }, 5000);
}

// ================= NEW FEATURES (FAVS, REVIEWS, OFFERS) =================
function showSimpleToast(msg) {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.style.background = "rgba(15, 23, 42, 0.92)";
  toast.style.backdropFilter = "blur(12px)";
  toast.style.color = "white";
  toast.style.padding = "12px 20px";
  toast.style.borderRadius = "12px";
  toast.style.border = "1px solid rgba(255,255,255,0.15)";
  toast.style.boxShadow = "0 10px 30px rgba(0,0,0,0.45)";
  toast.style.fontSize = "13.5px";
  toast.style.fontWeight = "600";
  toast.style.pointerEvents = "auto";
  toast.innerText = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

let userFavorites = new Set();
async function initFavorites() {
  const token = localStorage.getItem("token");
  if (!token) return;
  try {
    const res = await fetch(`${API_BASE_URL}/api/restaurants/favorites`, {
  headers: { Authorization: token }
});
   // const res = await fetch("http://localhost:5000/api/restaurants/favorites", { headers: { Authorization: token } });
    if(res.ok) {
      const favs = await res.json();
      userFavorites = new Set(favs.map(f => f.restaurantId));
    }
  } catch (e) { console.error(e); }
}
document.addEventListener("DOMContentLoaded", initFavorites);

async function toggleFavorite(restaurantId, restaurantName, locality, city, btnElement) {
  const token = localStorage.getItem("token");
  if (!token) return showSimpleToast("Please login to save restaurants.");
  const isFav = userFavorites.has(restaurantId);
  
  try {
    if (isFav) {
      await fetch(`${API_BASE_URL}/api/restaurants/favorites/${restaurantId}`, { method: 'DELETE', headers: { Authorization: token } });
      userFavorites.delete(restaurantId);
      btnElement.innerText = "🤍";
      showSimpleToast("Removed from favorites");
    } else {
      await fetch(`${API_BASE_URL}/api/restaurants/favorites`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: token },
        body: JSON.stringify({ restaurantId, restaurantName, locality, city })
      });
      userFavorites.add(restaurantId);
      btnElement.innerText = "❤️";
      showSimpleToast("Added to favorites!");
    }
  } catch(e) { console.error(e); }
}

async function loadFavorites() {
  const resultDiv = document.getElementById("results");
  resultDiv.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #64748b;">Loading saved restaurants...</div>`;
  const token = localStorage.getItem("token");
  try {
    const res = await fetch(`${API_BASE_URL}/api/restaurants/favorites`, { headers: { Authorization: token } });
    const favs = await res.json();
    if (favs.length === 0) {
      resultDiv.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:#64748b; padding:40px;">You haven't saved any restaurants yet.</p>`;
      return;
    }
    resultDiv.innerHTML = "";
    favs.forEach(f => {
      // Render glass card for favorites
      resultDiv.innerHTML += `
        <div class="card" style="padding:22px;">
          <div style="display:flex; justify-content:space-between; align-items:start;">
            <h3 style="font-size:18px; font-weight:700; color:var(--text-title); margin-bottom:8px;">${f.restaurantName}</h3>
            <button onclick="toggleFavorite('${f.restaurantId}', '${f.restaurantName.replace(/'/g, "\\'")}', '${(f.locality || '').replace(/'/g, "\\'")}', '${(f.city || '').replace(/'/g, "\\'")}', this); setTimeout(loadFavorites, 500);" style="background:rgba(239,68,68,0.14); border:1px solid rgba(239,68,68,0.3); border-radius:50%; width:36px; height:36px; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; font-size:18px;">❤️</button>
          </div>
          <p style="font-size:13px; color:var(--text-muted);">${f.locality || f.city || 'Bangalore'}</p>
        </div>
      `;
    });
  } catch(e) {
    resultDiv.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:red;">Failed to load favorites.</p>`;
  }
}

async function loadOffers() {
  const resultDiv = document.getElementById("results");
  resultDiv.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">Loading active offers...</div>`;
  const token = localStorage.getItem("token");
  try {
    const res = await fetch(`${API_BASE_URL}/api/notifications/offers`, { headers: { Authorization: token } });
    const offers = await res.json();
    if (offers.length === 0) {
      resultDiv.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:40px;">No active offers right now.</p>`;
      return;
    }
    resultDiv.innerHTML = "";
    offers.forEach(o => {
      resultDiv.innerHTML += `
        <div class="card" style="padding:22px; border-left:4px solid #f97316;">
          <div style="font-size: 11px; font-weight:800; color:#fb923c; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.5px;">Special Offer</div>
          <h3 style="font-size:18px; font-weight:700; color:var(--text-title); margin-bottom:6px;">${o.title}</h3>
          <p style="font-size:13.5px; color:var(--text-main); margin-bottom:12px; line-height:1.5;">${o.message}</p>
          <div style="font-size:11px; color:var(--text-muted);">Valid until: ${new Date(o.expiresAt).toLocaleDateString()}</div>
        </div>
      `;
    });
  } catch(e) {
    resultDiv.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:red;">Failed to load offers.</p>`;
  }
}

function toggleReviewForm(id) {
  const form = document.getElementById(`review-form-${id}`);
  if (form) form.style.display = form.style.display === "none" ? "block" : "none";
}

async function submitReview(restaurantId, restaurantName) {
  const rating = document.getElementById(`review-rating-${restaurantId}`).value;
  const text = document.getElementById(`review-text-${restaurantId}`).value;
  
  const tags = [];
  ['Food','Service','Price','Ambiance'].forEach(t => {
    const cb = document.getElementById(`tag-${t}-${restaurantId}`);
    if (cb && cb.checked) tags.push(t);
  });

  if (!rating || !text) {
    return showSimpleToast("Rating and text are required.");
  }

  const token = localStorage.getItem("token");
  try {
    const res = await fetch(`${API_BASE_URL}/api/restaurants/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: token },
      body: JSON.stringify({ restaurantId, restaurantName, rating: Number(rating), text, tags })
    });
    
    if (res.ok) {
      showSimpleToast("Review submitted successfully!");
      toggleReviewForm(restaurantId);
      // Optional: append review to DOM immediately
    } else {
      const data = await res.json();
      showSimpleToast(data.msg || "Failed to submit review.");
    }
  } catch(e) {
    console.error(e);
    showSimpleToast("Error submitting review.");
  }
}
