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

  const booking = {
    issue: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    preferredTime: '',
    notes: '',
    step: 'issue' // issue → name → phone → email → address → time → verify → done
  };

  function createWidget() {
    const toggle = document.createElement('button');
    toggle.className = 'holden-ai-toggle';
    toggle.setAttribute('aria-label', 'Open Holden AI Assistant');
    toggle.innerHTML = `
      <img src="${LOGO}" alt="Holden Heating & Cooling" onerror="this.src='apple-touch-icon.png'">
      <span class="holden-ai-toggle-text">Let's Chat</span>
    `;

    const panel = document.createElement('div');
    panel.className = 'holden-ai-panel';
    panel.innerHTML = `
      <div class="holden-ai-header">
        <img src="${LOGO}" alt="Holden" onerror="this.src='apple-touch-icon.png'">
        <div>
          <h4>Anna · Holden Receptionist</h4>
          <p>HVAC help • Call ${PHONE}</p>
        </div>
        <button class="holden-ai-close" aria-label="Close chat">&times;</button>
      </div>
      <div class="holden-ai-messages" id="aiMessages"></div>
      <div class="holden-ai-quick" id="aiQuick"></div>
      <div class="holden-ai-input-area">
        <input type="text" id="aiInput" placeholder="Type your message..." autocomplete="off">
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
      addMessage(`📞 <strong>Need same-day service?</strong> Call <a href="${PHONE_LINK}">${PHONE}</a><br>Or email <a href="mailto:${EMAIL}">${EMAIL}</a>`);
    }

    function resetBooking() {
      booking.issue = '';
      booking.name = '';
      booking.phone = '';
      booking.email = '';
      booking.address = '';
      booking.preferredTime = '';
      booking.notes = '';
      booking.step = 'issue';
    }

    function nextPrompt() {
      switch (booking.step) {
        case 'issue':
          return "Thank you for chatting with Holden Heating and Cooling. My name is Holly. How can I help you with your heating or cooling system today?";
        case 'name':
          return "Thank you for describing the issue. Could you please provide your first and last name?";
        case 'phone':
          return "What is the best phone number to reach you and send updates?";
        case 'email':
          return "And what is your email address so we can send you the service confirmation and details?";
        case 'address':
          return "Could you please provide the full service address, including the street address, unit or apartment number if applicable, city, state, and ZIP code?";
        case 'time':
          return "What day and time window works best for you to have our technician come out? Do you have any specific scheduling preferences or notes?";
        case 'verify':
          return "Is there anything else I can help you with today, or any additional notes for our technician?";
        default:
          return null;
      }
    }

    function summarize() {
      return `Here’s a quick summary of what I have:<br><br>
        <strong>Issue:</strong> ${booking.issue || '—'}<br>
        <strong>Name:</strong> ${booking.name || '—'}<br>
        <strong>Phone:</strong> ${booking.phone || '—'}<br>
        <strong>Email:</strong> ${booking.email || '—'}<br>
        <strong>Address:</strong> ${booking.address || '—'}<br>
        <strong>Preferred time:</strong> ${booking.preferredTime || '—'}<br>
        ${booking.notes ? `<strong>Notes:</strong> ${booking.notes}<br>` : ''}
        <br>We will send you an email confirmation with all the appointment details, as well as a text message to your phone number to confirm your booking.<br><br>
        Thank you so much for calling Holden Heating and Cooling. Our team will be in touch with you right away. Have a wonderful day!`;
    }

    function isOregon(address) {
      const a = address.toLowerCase();
      return /\bor\b|\boregon\b/.test(a) && !/\bwa\b|\bwashington\b|\bca\b|\bcalifornia\b|\bid\b|\bidaho\b/.test(a);
    }

    function handleFAQ(q) {
      if (/call|phone|number|contact/.test(q)) {
        return `You can reach Holden Heating & Cooling right now at <strong><a href="${PHONE_LINK}">${PHONE}</a></strong>. We offer same-day service across the Portland metro.`;
      }
      if (/email|message|send|book|schedule|appointment/.test(q) && booking.step === 'issue') {
        return `I’d be happy to help you schedule service. Let’s start with the issue.`;
      }
      if (/service|repair|tune|maintenance|install|air quality|hvac|ac |furnace|heat pump|what do you/.test(q)) {
        let reply = `<strong>Our main services:</strong><br>`;
        knowledge.services.forEach(s => {
          reply += `• <strong>${s.name}</strong> — ${s.desc} <a href="${s.page}">Learn more</a><br>`;
        });
        reply += `<br>Current special: <strong>$89</strong> A/C, Furnace & Heat Pump Professional Maintenance.`;
        return reply;
      }
      if (/price|cost|how much|offer|special|89|deal/.test(q)) {
        return `We have a limited-time offer: <strong>$89</strong> for A/C, Furnace & Heat Pump Professional Maintenance (regularly $179).<br>Diagnostics start at $89. For exact pricing on repairs or installs, call us — every home is different.`;
      }
      if (/area|location|where|portland|beaverton|hillsboro|serve/.test(q)) {
        return `We proudly serve <strong>${knowledge.areas}</strong><br>Licensed & bonded: ${knowledge.license}. We only service the state of Oregon.`;
      }
      if (/hour|open|same.day|emergency|today/.test(q)) {
        return `${knowledge.hours}<br>For the fastest response, call <a href="${PHONE_LINK}">${PHONE}</a> now.`;
      }
      if (/logo|who are you|about|holden|anna/.test(q)) {
        return `I’m Anna, the Holden Heating & Cooling virtual receptionist. We’re a trusted local HVAC team in Portland, OR (CCB #253995). We handle repair, maintenance, installation, and indoor air quality.`;
      }
      return null;
    }

    function processStep(text) {
      const q = text.toLowerCase().trim();

      // Handle interruptions / clarifying questions mid-flow
      if (/what|how|why|can you|do you|interrupt|sorry|wait/.test(q) && booking.step !== 'issue' && booking.step !== 'done') {
        addMessage("I'm sorry about that, I'm listening. Please go ahead.");
        return;
      }

      switch (booking.step) {
        case 'issue': {
          const faq = handleFAQ(q);
          if (faq && !text.includes('heat') && !text.includes('cool') && !text.includes('ac') && !text.includes('furnace') && text.length < 40) {
            addMessage(faq);
            addMessage(nextPrompt());
            return;
          }
          booking.issue = text;
          if (/no heat|not heating|no cool|not cooling|broke|broken|down|emergency|urgent|stress|help/.test(q)) {
            addMessage("I understand, let's get this sorted out and help you right away.");
          }
          booking.step = 'name';
          addMessage("Thank you. " + nextPrompt());
          break;
        }
        case 'name': {
          booking.name = text;
          // Simple check for potentially complex names
          if (/[^a-z\s\-']/i.test(text) || text.split(' ').length > 3 || text.length > 25) {
            addMessage(`Let me make sure I have that spelled correctly: ${text}, is that right? If needed, please spell it out letter by letter.`);
          } else {
            addMessage(`Let me make sure I have that spelled correctly: ${text}, is that right?`);
          }
          booking.step = 'name_confirm';
          break;
        }
        case 'name_confirm': {
          if (/yes|yep|correct|right|ok|yeah|sure/.test(q)) {
            booking.step = 'phone';
            addMessage(nextPrompt());
          } else {
            booking.name = text;
            addMessage(`Updated. Let me confirm: ${booking.name}, is that correct?`);
          }
          break;
        }
        case 'phone': {
          booking.phone = text.replace(/\D/g, '').length >= 10 ? text : text;
          booking.step = 'email';
          addMessage(nextPrompt());
          break;
        }
        case 'email': {
          booking.email = text;
          booking.step = 'address';
          addMessage(nextPrompt());
          break;
        }
        case 'address': {
          if (!isOregon(text)) {
            addMessage("I'm sorry, but we currently provide service exclusively within Oregon. We are unable to take jobs outside of the state.");
            addMessage("If you have an Oregon address, please provide the full service address.");
            return;
          }
          booking.address = text;
          booking.step = 'time';
          addMessage(nextPrompt());
          break;
        }
        case 'time': {
          booking.preferredTime = text;
          booking.step = 'verify';
          addMessage("Just to make sure we have everything complete...");
          // Check for missing pieces
          const missing = [];
          if (!booking.issue) missing.push('a description of the issue');
          if (!booking.name) missing.push('your full name');
          if (!booking.phone) missing.push('your phone number');
          if (!booking.email) missing.push('your email');
          if (!booking.address) missing.push('the full service address');
          if (missing.length) {
            addMessage(`Could you also provide ${missing.join(', ')}?`);
            return;
          }
          addMessage(nextPrompt());
          break;
        }
        case 'verify': {
          if (text && !/no|nothing|that's all|all good|nope/.test(q)) {
            booking.notes = (booking.notes ? booking.notes + '; ' : '') + text;
          }
          addMessage(summarize());
          booking.step = 'done';
          addCallPrompt();
          break;
        }
        case 'done': {
          const faq = handleFAQ(q);
          if (faq) {
            addMessage(faq);
          } else if (/start over|new|another|book again/.test(q)) {
            resetBooking();
            addMessage("Of course. Let's start a new request.");
            addMessage(nextPrompt());
          } else {
            addMessage("Thank you! If you need anything else, just let me know, or call us at " + PHONE + ".");
          }
          break;
        }
        default:
          addMessage("I’m here to help. " + (nextPrompt() || "How can I assist you today?"));
      }
    }

    function handleUserMessage(text) {
      if (!text) return;
      addMessage(text, true);
      inputEl.value = '';

      // Simulate the measured pace
      setTimeout(() => {
        processStep(text);
      }, 600);
    }

    function sendMessage() {
      const text = inputEl.value.trim();
      if (!text) return;
      handleUserMessage(text);
    }

    // Quick buttons
    const quicks = [
      { label: 'Start Booking', q: 'I need service for my heating/cooling system' },
      { label: 'Our Services', q: 'What services do you offer?' },
      { label: '$89 Offer', q: 'Tell me about the $89 offer' },
      { label: 'Call Now', q: 'What is your phone number?' },
      { label: 'Service Areas', q: 'Where do you serve?' }
    ];
    quicks.forEach(item => {
      const btn = document.createElement('button');
      btn.textContent = item.label;
      btn.onclick = () => {
        if (item.label === 'Start Booking') {
          resetBooking();
          addMessage("I'd be happy to help you schedule service.");
          addMessage(nextPrompt());
        } else {
          handleUserMessage(item.q);
        }
      };
      quickEl.appendChild(btn);
    });

    // Events
    toggle.onclick = () => {
      panel.classList.toggle('open');
      if (panel.classList.contains('open') && messagesEl.children.length === 0) {
        setTimeout(() => {
          addMessage("Thank you for calling Holden Heating and Cooling. My name is Anna. How can I help you with your heating or cooling system today?");
        }, 300);
      }
    };
    closeBtn.onclick = () => panel.classList.remove('open');
    sendBtn.onclick = sendMessage;
    inputEl.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createWidget);
  } else {
    createWidget();
  }
})();
