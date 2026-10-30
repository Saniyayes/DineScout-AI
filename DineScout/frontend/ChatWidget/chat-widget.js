/**
 * DineScout AI - Persistent Floating Chatbot Widget
 */

(function () {
  // Prevent duplicate initialization
  if (window.DineScoutChatInitialized) return;
  window.DineScoutChatInitialized = true;

  // Session ID management
  let sessionId = sessionStorage.getItem("dinescout_chat_session_id");
  if (!sessionId) {
    sessionId = "session_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now();
    sessionStorage.setItem("dinescout_chat_session_id", sessionId);
  }

  // Get User Role
  const userRole = localStorage.getItem("role") || "user";

  // Create UI Elements
  function buildWidgetHTML() {
    // Trigger Button
    const trigger = document.createElement("button");
    trigger.className = "dinescout-chat-trigger";
    trigger.id = "chat-trigger-btn";
    trigger.setAttribute("aria-label", "Open DineScout AI Chat Assistant");
    trigger.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    `;

    // Chat Window
    const windowDiv = document.createElement("div");
    windowDiv.className = "dinescout-chat-window";
    windowDiv.id = "chat-window-panel";
    windowDiv.innerHTML = `
      <div class="dinescout-chat-header">
        <div class="dinescout-chat-header-info">
          <h4>Dine<span>Scout</span> AI</h4>
          <span class="dinescout-chat-status">Active Assistant</span>
        </div>
        <button class="dinescout-chat-close" id="chat-close-btn">✕</button>
      </div>

      <div class="dinescout-chat-messages" id="chat-msg-area">
        <div class="chat-msg bot">
          Hello! I am your <b>DineScout AI Assistant</b>. How can I help you discover restaurants or analyze market trends today?
        </div>
      </div>

      <div class="chat-typing" id="chat-typing-indicator">
        <span></span><span></span><span></span>
      </div>

      <div class="chat-quick-replies" id="chat-quick-replies-area">
        <button class="chat-chip" onclick="window.sendDineScoutChat('Romantic date spots')">Romantic dates</button>
        <button class="chat-chip" onclick="window.sendDineScoutChat('Quiet cafe for work')">Work cafes</button>
        <button class="chat-chip" onclick="window.sendDineScoutChat('Budget food under 500')">Budget under ₹500</button>
      </div>

      <div class="dinescout-chat-input-area">
        <input type="text" id="chat-input-field" placeholder="Ask about restaurants or vibes..." onkeydown="if(event.key==='Enter') window.sendDineScoutChat()" />
        <button class="dinescout-chat-send" id="chat-send-btn" onclick="window.sendDineScoutChat()">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
          </svg>
        </button>
      </div>
    `;

    document.body.appendChild(trigger);
    document.body.appendChild(windowDiv);

    // Event Listeners
    trigger.addEventListener("click", toggleChat);
    document.getElementById("chat-close-btn").addEventListener("click", toggleChat);
  }

  function toggleChat() {
    const win = document.getElementById("chat-window-panel");
    if (win) {
      win.classList.toggle("open");
      if (win.classList.contains("open")) {
        document.getElementById("chat-input-field")?.focus();
        checkAndRequestLocation();
      }
    }
  }

  function checkAndRequestLocation() {
    if (sessionStorage.getItem("chat_location_requested")) return;
    sessionStorage.setItem("chat_location_requested", "true");

    const msgArea = document.getElementById("chat-msg-area");
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          window.userLat = position.coords.latitude;
          window.userLon = position.coords.longitude;
          sessionStorage.setItem("chat_lat", window.userLat);
          sessionStorage.setItem("chat_lon", window.userLon);
        },
        (error) => {
          console.warn("Location denied by user in chat.");
          const botBubble = document.createElement("div");
          botBubble.className = "chat-msg bot";
          botBubble.innerHTML = "<i>Location access denied. Please type your area (e.g. 'near Indiranagar') so I can search nearby.</i>";
          msgArea.appendChild(botBubble);
          msgArea.scrollTop = msgArea.scrollHeight;
        }
      );
    }
  }

  // Global Chat Send Method
  window.sendDineScoutChat = async function (overrideText) {
    const input = document.getElementById("chat-input-field");
    const msgArea = document.getElementById("chat-msg-area");
    const typing = document.getElementById("chat-typing-indicator");
    const quickArea = document.getElementById("chat-quick-replies-area");

    const text = overrideText || (input ? input.value.trim() : "");
    if (!text) return;

    if (input) input.value = "";

    // Append User Message
    const userBubble = document.createElement("div");
    userBubble.className = "chat-msg user";
    userBubble.textContent = text;
    msgArea.appendChild(userBubble);
    msgArea.scrollTop = msgArea.scrollHeight;

    // Show Typing Indicator
    if (typing) typing.classList.add("active");

    try {
      const token = localStorage.getItem("token");
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const chatLat = sessionStorage.getItem("chat_lat") || window.userLat || (typeof userLat !== "undefined" ? userLat : null);
      const chatLon = sessionStorage.getItem("chat_lon") || window.userLon || (typeof userLon !== "undefined" ? userLon : null);

      const chatEndpoint = window.location.origin.startsWith("http")
        ? `${window.location.origin}/api/chat`
        : "https://dinescout-ai.onrender.com/api/chat";

      const res = await fetch(chatEndpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: text,
          sessionId: sessionId,
          role: userRole,
          lat: chatLat,
          lon: chatLon,
          city: window.userCity || (typeof userCity !== "undefined" ? userCity : null)
        })
      });

      const data = await res.json();

      // Hide Typing Indicator
      if (typing) typing.classList.remove("active");

      // Append Bot Reply
      const botBubble = document.createElement("div");
      botBubble.className = "chat-msg bot";
      botBubble.innerHTML = formatMarkdownText(data.reply || "Here are your results:");

      // Render Compact Restaurant Cards inside chat bubble if present
      if (data.restaurants && data.restaurants.length > 0) {
        const cardList = document.createElement("div");
        cardList.className = "chat-card-list";

        data.restaurants.forEach(r => {
          const card = document.createElement("div");
          card.className = "chat-card";
          card.innerHTML = `
            <div class="chat-card-title">
              <span>${r.name}</span>
              <span class="chat-card-rating">★ ${r.rating}</span>
            </div>
            <div class="chat-card-meta">
              <span>${r.cuisines ? r.cuisines.split(',')[0] : 'Multi-Cuisine'}</span>
              <span>₹${r.cost} for 2</span>
            </div>
          `;
          card.onclick = () => {
            // Open AI Review Summary or Filter by this restaurant
            if (typeof window.openReviewSummary === "function" && r.id) {
              window.openReviewSummary(r.id);
            }
          };
          cardList.appendChild(card);
        });

        botBubble.appendChild(cardList);
      }

      msgArea.appendChild(botBubble);
      msgArea.scrollTop = msgArea.scrollHeight;

      // Update Quick Reply Chips
      if (quickArea && data.quickReplies && data.quickReplies.length > 0) {
        quickArea.innerHTML = data.quickReplies
          .map(q => `<button class="chat-chip" onclick="window.sendDineScoutChat('${q}')">${q}</button>`)
          .join("");
      }

    } catch (err) {
      console.error("Chat error:", err);
      if (typing) typing.classList.remove("active");

      const errBubble = document.createElement("div");
      errBubble.className = "chat-msg bot";
      errBubble.textContent = "Cannot connect to assistant server. Please verify backend service.";
      msgArea.appendChild(errBubble);
      msgArea.scrollTop = msgArea.scrollHeight;
    }
  };

  function formatMarkdownText(str) {
    if (!str) return "";
    return str
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
      .replace(/\n/g, '<br/>');
  }

  // Initialize on DOM load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildWidgetHTML);
  } else {
    buildWidgetHTML();
  }
})();
