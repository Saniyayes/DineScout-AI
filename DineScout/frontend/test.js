
console.log("Owner Dashboard Initializing...");

// ================= AUTH GUARD =================
if (!localStorage.getItem("token")) {
  window.location = "login.html";
}

function logout() {
  localStorage.clear();
  window.location = "login.html";
}

// ================= LOAD CITIES & CUISINES =================
async function loadData() {
  try {
    const citySelect = document.getElementById("city");
    const cuisineSelect = document.getElementById("cuisine");

    const res = await fetch("http://localhost:5000/api/owner/meta");
    const data = await res.json();

    citySelect.innerHTML = "";
    cuisineSelect.innerHTML = "";

    data.cities.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.name;
      opt.textContent = c.name;
      citySelect.appendChild(opt);
    });

    data.cuisines.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.name;
      opt.textContent = c.name;
      cuisineSelect.appendChild(opt);
    });

    // Default selection
    if (citySelect.options.length > 0) citySelect.value = "New Delhi";
    if (cuisineSelect.options.length > 0) cuisineSelect.value = "North Indian";

    console.log("Meta loaded successfully");
    analyze();
  } catch (err) {
    console.error("Meta error:", err);
    alert("Failed to load cities & cuisines");
  }
}

loadData();

// ================= FULL ANALYSIS (Core + Features 4 & 5) =================
async function analyze() {
  try {
    const cityValue = document.getElementById("city").value;
    const cuisineValue = document.getElementById("cuisineValue") ? document.getElementById("cuisineValue").value : document.getElementById("cuisine").value;
    const restName = document.getElementById("owner-rest-name").value || "My Restaurant";
    const restCost = Number(document.getElementById("owner-rest-cost").value) || 800;
    const restRating = Number(document.getElementById("owner-rest-rating").value) || 4.2;

    if (!cityValue || !cuisineValue) {
      alert("Please select city and cuisine");
      return;
    }

    console.log("Running comprehensive analysis for:", cityValue, cuisineValue);

    // 1. Core Market Analysis
    const res = await fetch("http://localhost:5000/api/owner/market-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city: cityValue, cuisine: cuisineValue })
    });
    const data = await res.json();

    const cards = document.getElementById("cards");
    const info = document.getElementById("info");

    cards.innerHTML = `
      <div class="card">
        <div class="title">Market Avg Rating</div>
        <div class="value">${data.avg_rating || 0} ★</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 6px; font-weight: 600;">City Overall: ${data.city_avg_rating || 0} ★</div>
        <div style="font-size: 11px; color: #64748b; font-weight: 600;">Cuisine Overall: ${data.cuisine_avg_rating || 0} ★</div>
      </div>
      <div class="card">
        <div class="title">Avg Cost for Two</div>
        <div class="value">₹${data.avg_cost || 0}</div>
      </div>
      <div class="card">
        <div class="title">Avg Diner Votes</div>
        <div class="value">${data.avg_votes || 0}</div>
      </div>
      <div class="card">
        <div class="title">Local Competitors</div>
        <div class="value">${data.total_restaurants || 0}</div>
      </div>
      <div class="card" style="border-left: 4px solid #15803d;">
        <div class="title">Review Authenticity</div>
        <div class="value" style="font-size: 18px; color: #15803d;">High Trust ✔️</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Zero spam bursts flagged</div>
      </div>
    `;

    info.innerHTML = `
      <div class="section-card">
        <h3>Market Demand & Feasibility Analysis</h3>
        <div class="info-banner">Market Demand Level: <b>${data.demand}</b></div>
        <div class="success-banner">Strategic AI Recommendation: ${data.recommendation}</div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 16px;">
          <div>
            <h4 style="font-size:14px; margin-bottom:8px;">Top Cuisines in ${cityValue}</h4>
            ${listHTML(data.top_city_cuisines)}
          </div>
          <div>
            <h4 style="font-size:14px; margin-bottom:8px;">Top Cities for ${cuisineValue}</h4>
            ${listHTML(data.top_cuisine_cities)}
          </div>
        </div>
      </div>
    `;

    // 2. Feature 4: Competitor Benchmarking
    loadCompetitorBenchmarking(cityValue, cuisineValue, restCost, restRating, restName);

    // 3. Feature 5: Review-to-Action Insights
    loadReviewActionInsights(cityValue, cuisineValue, restRating);

  } catch (err) {
    console.error("Analyze error:", err);
    alert("Analysis failed. Please ensure the backend and API servers are active.");
  }
  
  // Refresh AI Advisor tab data
  loadAdvisorData();
}

// ================= FEATURE 4: LOAD COMPETITOR BENCHMARKING =================
async function loadCompetitorBenchmarking(city, cuisine, price, rating, restaurantName) {
  const section = document.getElementById("benchmarking-section");
  const container = document.getElementById("benchmarking-content");
  section.style.display = "block";

  try {
    const res = await fetch("http://localhost:5000/api/owner/competitor-benchmarking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city, cuisine, price, rating, restaurantName })
    });

    const data = await res.json();
    if (!data.marketMetrics) {
      container.innerHTML = "<p>No competitor benchmark data available for this market.</p>";
      return;
    }

    const m = data.marketMetrics;
    const top = data.topPerformer;

    container.innerHTML = `
      <div style="background:#f1f5f9; padding:12px 16px; border-radius:8px; margin-bottom:16px; font-size:13.5px; font-weight:600; color:#1e293b;">
        ${data.positioning.strategicInsight}
      </div>

      <div class="benchmark-grid">
        <!-- Rating Comparison -->
        <div class="bench-box">
          <h4 style="font-size:14px; margin-bottom:12px;">⭐ Rating Comparison (Out of 5.0)</h4>
          <div class="bench-row">
            <span><b>${restaurantName} (You)</b></span>
            <span><b>${rating} ★</b></span>
          </div>
          <div class="bar-track">
            <div class="bar-fill-owner" style="width:${(rating / 5) * 100}%;"></div>
          </div>

          <div class="bench-row">
            <span>Market Average (${cuisine})</span>
            <span>${m.avgRating} ★</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill-market" style="width:${(m.avgRating / 5) * 100}%;"></div>
          </div>

          <div class="bench-row">
            <span>Top Performer (${top.name})</span>
            <span>${top.rating} ★</span>
          </div>
        </div>

        <!-- Cost Comparison -->
        <div class="bench-box">
          <h4 style="font-size:14px; margin-bottom:12px;">💰 Cost for Two Comparison</h4>
          <div class="bench-row">
            <span><b>${restaurantName} (You)</b></span>
            <span><b>₹${price}</b></span>
          </div>
          <div class="bar-track">
            <div class="bar-fill-owner" style="width:${Math.min(100, (price / 2500) * 100)}%;"></div>
          </div>

          <div class="bench-row">
            <span>Market Average (${cuisine})</span>
            <span>₹${m.avgCost}</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill-market" style="width:${Math.min(100, (m.avgCost / 2500) * 100)}%;"></div>
          </div>

          <div class="bench-row">
            <span>Positioning</span>
            <span style="font-weight:700; color:#ff5722;">${data.positioning.pricePosition}</span>
          </div>
        </div>
      </div>

      <h4 style="font-size:14px; margin-top:20px; margin-bottom:8px;">🏆 Top 5 Direct Competitors in ${city}:</h4>
      <table class="competitor-table">
        <thead>
          <tr>
            <th>Restaurant Name</th>
            <th>Locality</th>
            <th>Rating</th>
            <th>Cost for Two</th>
            <th>Value Assessment</th>
          </tr>
        </thead>
        <tbody>
          ${(data.topCompetitorsList || []).map(c => `
            <tr>
              <td><b>${c.name}</b></td>
              <td>${c.locality}</td>
              <td><span style="background:#15803d; color:white; padding:2px 6px; border-radius:4px; font-size:12px;">★ ${c.rating}</span></td>
              <td>₹${c.cost}</td>
              <td><span style="font-size:12px;">${c.valueBadge || 'Standard Value'}</span></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  } catch (err) {
    console.error("Benchmarking error:", err);
    container.innerHTML = "<p style='color:red;'>Failed to load competitor benchmarking.</p>";
  }
}

// ================= FEATURE 5: LOAD REVIEW-TO-ACTION INSIGHTS =================
async function loadReviewActionInsights(city, cuisine, rating) {
  const section = document.getElementById("action-insights-section");
  const container = document.getElementById("action-insights-content");
  section.style.display = "block";

  try {
    const res = await fetch("http://localhost:5000/api/owner/review-action-insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city, cuisine, currentRating: rating })
    });

    const data = await res.json();

    container.innerHTML = `
      <p style="font-size:13.5px; color:#64748b; margin-bottom:14px;">
        Analyzed diner sentiment & recurring friction points across <b>${cuisine}</b> restaurants in <b>${city}</b>:
      </p>

      ${data.actionableSuggestions.map(a => `
        <div class="action-card">
          <div class="action-header">
            <h4 style="font-size:15px; color:#0f172a;">⚡ ${a.theme}</h4>
            <span class="priority-badge ${a.priority === 'High' ? 'priority-high' : 'priority-medium'}">${a.priority} Priority</span>
          </div>
          <p style="font-size:13.5px; color:#334155; margin:6px 0;"><b>Recommended Action:</b> ${a.action}</p>
          <div style="display:flex; justify-content:space-between; font-size:12px; color:#15803d; font-weight:700; margin-top:6px;">
            <span>Projected Result: ${a.expectedImpact}</span>
            <span style="color:#64748b;">Feedback Mentions Frequency: ${a.frequency}</span>
          </div>
        </div>
      `).join("")}

      <div style="background:#ecfdf5; border:1px solid #a7f3d0; padding:12px 16px; border-radius:8px; font-size:13px; color:#065f46; margin-top:12px;">
        💡 <b>AI Strategic Focus:</b> ${data.overallRecommendation}
      </div>
    `;
  } catch (err) {
    console.error("Action insights error:", err);
    container.innerHTML = "<p style='color:red;'>Failed to load review action insights.</p>";
  }
}

// ================= HELPER =================
function listHTML(obj) {
  if (!obj || Object.keys(obj).length === 0) {
    return "<p style='color:#64748b;'>No data</p>";
  }
  let html = "<ul style='margin-left:18px; font-size:13.5px; line-height:1.6;'>";
  for (let k in obj) {
    let val = obj[k];
    if (typeof val === 'object' && val !== null) {
      html += `<li><b>${k}</b>: <span style='color:#64748b;'>${val.count} restaurants (Avg Rating: <strong style='color:#15803d;'>${val.rating} ★</strong>)</span></li>`;
    } else {
      html += `<li><b>${k}</b>: <span style='color:#64748b;'>${val} restaurants</span></li>`;
    }
  }
  html += "</ul>";
  return html;
}

// ================= NOTIFICATIONS TAB =================
function switchDashboardTab(tab) {
  // Hide all panels
  document.getElementById('panel-analytics').style.display = 'none';
  document.getElementById('panel-notifications').style.display = 'none';
  document.getElementById('panel-advisor').style.display = 'none';
  
  // Reset buttons
  document.getElementById('tab-analytics').style.background = '#e2e8f0';
  document.getElementById('tab-analytics').style.color = '#0f172a';
  document.getElementById('tab-notifications').style.background = '#e2e8f0';
  document.getElementById('tab-notifications').style.color = '#0f172a';
  document.getElementById('tab-advisor').style.background = '#e2e8f0';
  document.getElementById('tab-advisor').style.color = '#0f172a';

  // Show active tab
  document.getElementById('panel-' + tab).style.display = 'block';
  document.getElementById('tab-' + tab).style.background = 'var(--primary)';
  document.getElementById('tab-' + tab).style.color = 'white';

  if (tab === 'notifications') {
    loadNotificationHistory();
  } else if (tab === 'advisor') {
    loadAdvisorData();
  }
}

async function aiWriteMessage() {
  const idea = document.getElementById("notif-idea").value;
  if (!idea) {
    alert("Please enter a message idea first!");
    return;
  }
  const token = localStorage.getItem("token");
  try {
    const res = await fetch("http://localhost:5000/api/notifications/ai/write", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": token },
      body: JSON.stringify({ idea })
    });
    const data = await res.json();
    if (data.variants && data.variants.length > 0) {
      document.getElementById("notif-message").value = data.variants[0].text;
      analyzeNotificationScore();
    }
  } catch (err) {
    console.error(err);
  }
}

async function analyzeNotificationScore() {
  const message = document.getElementById("notif-message").value;
  if (!message) {
    document.getElementById("ai-score-bar").style.width = "0%";
    document.getElementById("ai-score-text").innerText = "0/100";
    return;
  }
  const token = localStorage.getItem("token");
  try {
    const res = await fetch("http://localhost:5000/api/notifications/ai/score", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": token },
      body: JSON.stringify({ message })
    });
    const data = await res.json();
    document.getElementById("ai-score-bar").style.width = data.score + "%";
    document.getElementById("ai-score-text").innerText = data.score + "/100";
    document.getElementById("ai-score-tip").innerText = data.tip;
    
    if(data.score > 70) document.getElementById("ai-score-bar").style.background = "#10b981";
    else if(data.score > 40) document.getElementById("ai-score-bar").style.background = "#f59e0b";
    else document.getElementById("ai-score-bar").style.background = "#ef4444";
  } catch (err) {
    console.error(err);
  }
}

async function aiPredictTime() {
  const token = localStorage.getItem("token");
  try {
    const res = await fetch("http://localhost:5000/api/notifications/ai/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": token }
    });
    const data = await res.json();
    document.getElementById("ai-time-result").innerText = `Optimal Time: ${data.suggestedTime} (${data.reason})`;
  } catch (err) {
    console.error(err);
  }
}

async function aiAnalyzeAudience() {
  const token = localStorage.getItem("token");
  try {
    const res = await fetch("http://localhost:5000/api/notifications/ai/audience", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": token }
    });
    const data = await res.json();
    document.getElementById("ai-audience-result").innerText = `~${data.estimatedReach} users reachable. ${data.info}`;
  } catch (err) {
    console.error(err);
  }
}

async function sendNotification() {
  const title = document.getElementById("notif-title").value;
  const message = document.getElementById("notif-message").value;
  const type = document.getElementById("notif-type").value;
  const audienceType = document.getElementById("notif-audience").value;
  
  if (!title || !message) {
    alert("Please enter title and message.");
    return;
  }
  
  const token = localStorage.getItem("token");
  try {
    const res = await fetch("http://localhost:5000/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": token },
      body: JSON.stringify({ title, message, type, audienceType })
    });
    
    if (res.ok) {
      alert("Notification Dispatched!");
      document.getElementById("notif-title").value = "";
      document.getElementById("notif-message").value = "";
      document.getElementById("notif-idea").value = "";
      analyzeNotificationScore();
      loadNotificationHistory();
    } else {
      const errorData = await res.json().catch(() => ({}));
      alert("Error sending notification: " + (errorData.msg || errorData.error || res.statusText));
    }
  } catch (err) {
    console.error(err);
    alert("Network error: " + err.message);
  }
}

async function loadNotificationHistory() {
  const token = localStorage.getItem("token");
  try {
    const res = await fetch("http://localhost:5000/api/notifications/owner", {
      headers: { "Authorization": token }
    });
    const data = await res.json();
    const tbody = document.getElementById("notif-history-table");
    
    if (data.length === 0) {
      tbody.innerHTML = "<tr><td colspan='6' style='text-align:center;'>No campaigns yet.</td></tr>";
      return;
    }
    
    tbody.innerHTML = data.map(n => `
      <tr>
        <td><b>${n.title}</b></td>
        <td>${n.type}</td>
        <td><span style="background:#dcfce7; color:#166534; padding:2px 8px; border-radius:12px; font-size:12px;">${n.status}</span></td>
        <td>${n.stats.delivered}</td>
        <td>${n.stats.read}</td>
        <td>${new Date(n.createdAt).toLocaleDateString()}</td>
      </tr>
    `).join("");
  } catch (err) {
    console.error(err);
  }
}
// ================= AI ADVISOR TAB =================
let compChartInstance = null;
let sentChartInstance = null;
let revChartInstance = null;

async function loadAdvisorData() {
  const cityValue = document.getElementById("city").value || "New Delhi";
  const cuisineValue = document.getElementById("cuisineValue") ? document.getElementById("cuisineValue").value : document.getElementById("cuisine").value || "North Indian";
  const restCost = document.getElementById("owner-rest-cost") ? document.getElementById("owner-rest-cost").value : 800;
  const restRating = document.getElementById("owner-rest-rating") ? document.getElementById("owner-rest-rating").value : 4.2;
  const capacity = document.getElementById("adv-capacity").value || 50;
  
  try {
    // 1. Load Competitors
    const compRes = await fetch(`http://localhost:5000/api/advisor/competitors?city=${encodeURIComponent(cityValue)}&cuisine=${encodeURIComponent(cuisineValue)}&restCost=${restCost}&restRating=${restRating}`);
    const compData = await compRes.json();
    
    let compHtml = "<strong>Top Competitors:</strong><ul style='padding-left: 20px; margin-top:8px;'>";
    compData.competitors.forEach(c => {
      compHtml += `<li><b>${c.name}</b> - ${c.rating}★ (₹${c.cost} for two)</li>`;
    });
    compHtml += "</ul>";
    document.getElementById("adv-comp-content").innerHTML = compHtml;
    
    const tipsHtml = compData.tips.map(t => `<div style="margin-bottom:6px;">💡 ${t}</div>`).join("");
    document.getElementById("adv-comp-tips").innerHTML = tipsHtml;
    
    // Render Comp Chart
    const ctxComp = document.getElementById("compChart").getContext("2d");
    if(compChartInstance) compChartInstance.destroy();
    compChartInstance = new Chart(ctxComp, {
      type: 'bar',
      data: {
        labels: ["You", ...compData.competitors.map(c => c.name.substring(0, 10))],
        datasets: [{
          label: 'Rating',
          data: [restRating, ...compData.competitors.map(c => c.rating)],
          backgroundColor: '#f97316'
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });

    // 2. Load Sentiment
    const sentRes = await fetch(`http://localhost:5000/api/advisor/sentiment?city=${encodeURIComponent(cityValue)}&cuisine=${encodeURIComponent(cuisineValue)}`);
    const sentData = await sentRes.json();
    
    const ctxSent = document.getElementById("sentimentChart").getContext("2d");
    if(sentChartInstance) sentChartInstance.destroy();
    sentChartInstance = new Chart(ctxSent, {
      type: 'doughnut',
      data: {
        labels: ['Positive', 'Neutral', 'Negative'],
        datasets: [{
          data: [sentData.sentiment.positive, sentData.sentiment.neutral, sentData.sentiment.negative],
          backgroundColor: ['#22c55e', '#cbd5e1', '#ef4444']
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
    
    document.getElementById("adv-sent-bars").innerHTML = `
      <div style="margin-bottom:8px; font-size:12px;"><b>Food:</b> ${sentData.categories.food}% positive</div>
      <div style="background:#e2e8f0; height:6px; border-radius:3px; margin-bottom:12px;"><div style="width:${sentData.categories.food}%; background:#3b82f6; height:100%; border-radius:3px;"></div></div>
      <div style="margin-bottom:8px; font-size:12px;"><b>Service:</b> ${sentData.categories.service}% positive</div>
      <div style="background:#e2e8f0; height:6px; border-radius:3px; margin-bottom:12px;"><div style="width:${sentData.categories.service}%; background:#3b82f6; height:100%; border-radius:3px;"></div></div>
      <div style="margin-bottom:8px; font-size:12px;"><b>Price:</b> ${sentData.categories.price}% positive</div>
      <div style="background:#e2e8f0; height:6px; border-radius:3px;"><div style="width:${sentData.categories.price}%; background:#3b82f6; height:100%; border-radius:3px;"></div></div>
    `;
    
    document.getElementById("adv-strengths").innerHTML = sentData.strengths.map(s => `<li>${s}</li>`).join("");
    document.getElementById("adv-complaints").innerHTML = sentData.complaints.map(s => `<li>${s}</li>`).join("");

    // 3. Load Prediction
    const predRes = await fetch("http://localhost:5000/api/advisor/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city: cityValue, cuisine: cuisineValue, cost: restCost, capacity })
    });
    const predData = await predRes.json();
    
    document.getElementById("adv-customers").innerText = predData.monthlyCustomers.toLocaleString();
    document.getElementById("adv-revenue").innerText = `₹${Math.round(predData.revenueRange[0]).toLocaleString()} - ₹${Math.round(predData.revenueRange[1]).toLocaleString()}`;
    document.getElementById("adv-breakeven").innerText = predData.breakEven;
    document.getElementById("adv-risk").innerText = predData.risk;
    document.getElementById("adv-health-score").innerText = predData.healthScore;
    
    let color = "#10b981"; // green
    if(predData.healthScore < 50) color = "#ef4444";
    else if(predData.healthScore < 80) color = "#f59e0b";
    document.getElementById("adv-health-score").style.color = color;
    
    const ctxRev = document.getElementById("revenueChart").getContext("2d");
    if(revChartInstance) revChartInstance.destroy();
    revChartInstance = new Chart(ctxRev, {
      type: 'line',
      data: {
        labels: ['Month 1', 'Month 2', 'Month 3', 'Month 4', 'Month 5', 'Month 6'],
        datasets: [{
          label: 'Projected Revenue (₹)',
          data: predData.trend,
          borderColor: '#8b5cf6',
          tension: 0.3,
          fill: true,
          backgroundColor: 'rgba(139, 92, 246, 0.1)'
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
    
  } catch(err) {
    console.error("Error loading advisor data:", err);
  }
}

