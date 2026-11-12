(function () {
  'use strict';

  const PHONE = '971-677-0201';
  const PHONE_LINK = 'tel:+19716770201';
  const EMAIL = 'support@callholden.com';
  const LOGO = 'logo-circle.png';

  const knowledge = {
    services: [
      { name: 'Heating & Cooling Repair', desc: 'Fast diagnostics and expert repair for gas furnaces, heat pumps, and air conditioning systems of all major brands.', page: 'heating-cooling.html' },
      { name: 'System Tune-Up & Maintenance', desc: 'Seasonal maintenance that improves efficiency, lowers energy bills, and helps prevent unexpected breakdowns. Special $89 offer.', page: 'offers.html' },
      { name: 'New System Installation', desc: 'Professional removal of old equipment and precision installation of high-efficiency heating and cooling systems.', page: 'heating-cooling.html' },
      { name: 'Indoor Air Quality', desc: 'Advanced filtration and purification solutions that reduce dust, allergens, and airborne contaminants.', page: 'services.html' },
      { name: 'AC Repair', desc: 'Same-day air conditioning repair and diagnostics.', page: 'ac-repair.html' },
      { name: 'Furnace Repair', desc: 'Expert gas furnace repair and safety inspections.', page: 'furnace-repair.html' },
      { name: 'Heat Pump Repair', desc: 'Heat pump diagnostics, repair, and maintenance.', page: 'heat-pump-repair.html' }
    ],
    areas: 'Portland, Beaverton, Hillsboro, and surrounding metro areas in Oregon.',
    license: 'CCB #253995',
    hours: 'Same-day service available. Call anytime for emergency HVAC help.'
  };

  function createWidget() {
    const toggle = document.createElement('button');
    toggle.className = 'holden-ai-toggle';
    toggle.setAttribute('aria-label', 'Open Holden AI Assistant');
    toggle.innerHTML = `<img src="${LOGO}" alt="Holden Heating & Cooling" onerror="this.src='apple-touch-icon.png'">`;

    const panel = document.createElement('div');
    panel.className = 'holden-ai-panel';
    panel.innerHTML = `
      <div class="holden-ai-header">
        <img src="${LOGO}" alt="Holden" onerror="this.src='apple-touch-icon.png'">
        <div>
          <h4>Holden AI Assistant</h4>
          <p>HVAC help • Call ${PHONE}</p>
        </div>
        <button class="holden-ai-close" aria-label="Close chat">&times;</button>
      </div>
      <div class="holden-ai-messages" id="aiMessages"></div>
      <div class="holden-ai-quick" id="aiQuick"></div>
      <div class="holden-ai-input-area">
        <input type="text" id="aiInput" placeholder="Ask about services, pricing, or book..." autocomplete="off">
        <button id="aiSend">Send</button>
      </div>
    `;

    document.body.appendChild(toggle);
    document.body.appendChild(panel);

    const messagesEl = panel.querySelector('#aiMessages');
    const quickEl = panel.querySelector('#aiQuick');
    const inputEl = panel.querySelector('#aiInput');
    const sendBtn = panel.querySelector('#aiSend');
    const closeBtn = panel.querySelector('.holden-ai-close');

    function addMessage(text, isUser = false) {
      const div = document.createElement('div');
      div.className = 'holden-ai-msg ' + (isUser ? 'user' : 'bot');
      div.innerHTML = text;
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function addCallPrompt() {
      addMessage(`📞 <strong>Call us now for same-day service:</strong> <a href="${PHONE_LINK}">${PHONE}</a><br>Or email <a href="mailto:${EMAIL}">${EMAIL}</a>`);
    }

    function handleUserMessage(text) {
      const q = text.toLowerCase().trim();
      addMessage(text, true);
      inputEl.value = '';

      setTimeout(() => {
        let reply = '';

        if (/call|phone|number|contact/.test(q)) {
          reply = `You can reach Holden Heating & Cooling right now at <strong><a href="${PHONE_LINK}">${PHONE}</a></strong>. We offer same-day service across the Portland metro.`;
        } else if (/email|message|send|book|schedule|appointment/.test(q)) {
          reply = `I can help you send a message to our team.<br><br>
            <strong>Quick options:</strong><br>
            • Call <a href="${PHONE_LINK}">${PHONE}</a> for fastest service<br>
            • Email <a href="mailto:${EMAIL}?subject=Service Request from Website">support@callholden.com</a><br>
            • <a href="contact.html">Open the online booking form</a><br><br>
            Tell me your name, phone, and what you need and I’ll prepare an email for you.`;
        } else if (/service|repair|tune|maintenance|install|air quality|hvac|ac |furnace|heat pump|what do you/.test(q)) {
          reply = `<strong>Our main services:</strong><br>`;
          knowledge.services.forEach(s => {
            reply += `• <strong>${s.name}</strong> — ${s.desc} <a href="${s.page}">Learn more</a><br>`;
          });
          reply += `<br>Current special: <strong>$89</strong> A/C, Furnace & Heat Pump Professional Maintenance.`;
        } else if (/price|cost|how much|offer|special|89|deal/.test(q)) {
          reply = `We have a limited-time offer: <strong>$89</strong> for A/C, Furnace & Heat Pump Professional Maintenance (regularly $179).<br>
            Diagnostics start at $89. For exact pricing on repairs or installs, call us — every home is different.`;
        } else if (/area|location|where|portland|beaverton|hillsboro|serve/.test(q)) {
          reply = `We proudly serve <strong>${knowledge.areas}</strong><br>Licensed & bonded: ${knowledge.license}.`;
        } else if (/hour|open|same.day|emergency|today/.test(q)) {
          reply = `${knowledge.hours}<br>For the fastest response, call <a href="${PHONE_LINK}">${PHONE}</a> now.`;
        } else if (/logo|who are you|about|holden/.test(q)) {
          reply = `I’m the Holden Heating & Cooling AI assistant. We’re a trusted local HVAC team in Portland, OR (CCB #253995). We handle repair, maintenance, installation, and indoor air quality.`;
        } else {
          reply = `I’m here to help with heating, cooling, and air quality questions.<br>
            Try asking about: services, pricing, service areas, or how to book.<br>
            For immediate help, call <strong><a href="${PHONE_LINK}">${PHONE}</a></strong>.`;
        }

        addMessage(reply);
        addCallPrompt();
      }, 400);
    }

    function sendMessage() {
      const text = inputEl.value.trim();
      if (!text) return;
      handleUserMessage(text);
    }

    // Quick buttons
    const quicks = [
      { label: 'Our Services', q: 'What services do you offer?' },
      { label: '$89 Offer', q: 'Tell me about the $89 offer' },
      { label: 'Call Now', q: 'What is your phone number?' },
      { label: 'Send Message', q: 'I want to send a message' },
      { label: 'Service Areas', q: 'Where do you serve?' }
    ];
    quicks.forEach(item => {
      const btn = document.createElement('button');
      btn.textContent = item.label;
      btn.onclick = () => handleUserMessage(item.q);
      quickEl.appendChild(btn);
    });

    // Events
    toggle.onclick = () => panel.classList.toggle('open');
    closeBtn.onclick = () => panel.classList.remove('open');
    sendBtn.onclick = sendMessage;
    inputEl.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };

    // Welcome
    setTimeout(() => {
      addMessage(`Hi! I’m the Holden AI Assistant. I can help with HVAC services, pricing, booking, and more.<br><br>
        <strong>Call us anytime:</strong> <a href="${PHONE_LINK}">${PHONE}</a>`);
    }, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createWidget);
  } else {
    createWidget();
  }
})();
