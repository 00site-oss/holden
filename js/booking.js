(function () {
  'use strict';

  // ========== CONFIG – replace with your EmailJS keys ==========
  // 1. Go to https://www.emailjs.com and create a free account
  // 2. Add your Gmail / Google account as an Email Service
  // 3. Create an email template
  // 4. Paste your Public Key, Service ID and Template ID below
  var EMAILJS_PUBLIC_KEY = 'YOUR_PUBLIC_KEY';
  var EMAILJS_SERVICE_ID = 'YOUR_SERVICE_ID';
  var EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';
  // =============================================================

  var state = {
    step: 1,
    category: '',
    service: null,
    form: {}
  };

  var services = {
    'Air Conditioner': [
      { name: 'Air Conditioning System Diagnostic', price: 89, desc: 'Professional system evaluation to identify the root cause of your cooling issue.' },
      { name: 'Air Conditioner Tune-Up & Safety Inspection', price: 179, desc: 'Comprehensive maintenance and safety inspection for your AC system.' },
      { name: 'Air Conditioner & Furnace Tune-Up', price: 225, desc: 'Combined AC & furnace tune-up for complete seasonal maintenance.' }
    ],
    'Heater / Furnace': [
      { name: 'Furnace Diagnostic', price: 89, desc: 'Full diagnostic to find the cause of heating problems.' },
      { name: 'Furnace Tune-Up & Safety Inspection', price: 179, desc: 'Complete furnace maintenance and safety check.' },
      { name: 'Furnace & AC Tune-Up Combo', price: 225, desc: 'Both systems tuned up in one visit.' }
    ],
    'Heat Pump': [
      { name: 'Heat Pump Diagnostic', price: 89, desc: 'Expert evaluation of your heat pump system.' },
      { name: 'Heat Pump Tune-Up', price: 189, desc: 'Seasonal maintenance for optimal heat pump performance.' },
      { name: 'A/C & Heat Pump Tune-Up Special', price: 225, desc: 'Limited time dual-system tune-up offer.' }
    ],
    'Commercial HVAC': [
      { name: 'Commercial System Diagnostic', price: 149, desc: 'Diagnostic service for light commercial HVAC equipment.' },
      { name: 'Commercial Maintenance Visit', price: 299, desc: 'Scheduled maintenance for commercial systems.' }
    ]
  };

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function openModal() {
    var overlay = $('#bookOverlay');
    if (!overlay) return;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    goToStep(1);
  }

  function closeModal() {
    var overlay = $('#bookOverlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    state = { step: 1, category: '', service: null, form: {} };
  }

  function goToStep(n) {
    state.step = n;
    $$('.book-step').forEach(function (el) { el.classList.remove('active'); });
    var stepEl = $('#bookStep' + n);
    if (stepEl) stepEl.classList.add('active');

    var bar = $('#bookProgressBar');
    if (bar) bar.style.width = (n * 25) + '%';

    // Populate step 2 services
    if (n === 2) renderServices();
    // Populate summary on step 3
    if (n === 3) renderSummary();
  }

  function renderServices() {
    var list = $('#bookServiceList');
    if (!list) return;
    var items = services[state.category] || [];
    list.innerHTML = items.map(function (s, i) {
      return '<div class="book-service" data-index="' + i + '">' +
        '<div class="svc-title">' + s.name + '</div>' +
        '<div class="svc-desc">' + s.desc + '</div>' +
        '<div class="svc-price">$' + s.price.toFixed(2) + '</div>' +
        '</div>';
    }).join('');

    $$('.book-service', list).forEach(function (el) {
      el.addEventListener('click', function () {
        $$('.book-service', list).forEach(function (x) { x.classList.remove('selected'); });
        el.classList.add('selected');
        state.service = services[state.category][parseInt(el.getAttribute('data-index'), 10)];
        // Instantly move to the details form
        setTimeout(function () { goToStep(3); }, 180);
      });
    });
  }

  function renderSummary() {
    var box = $('#bookSummary');
    if (!box || !state.service) return;
    box.innerHTML = '<strong>' + state.service.name + '</strong><br>' +
      state.category + ' &nbsp;·&nbsp; <strong>$' + state.service.price.toFixed(2) + '</strong>';
  }

  function collectForm() {
    state.form = {
      firstName: ($('#bkFirstName') || {}).value || '',
      lastName: ($('#bkLastName') || {}).value || '',
      email: ($('#bkEmail') || {}).value || '',
      address: ($('#bkAddress') || {}).value || '',
      city: ($('#bkCity') || {}).value || '',
      state: ($('#bkState') || {}).value || '',
      zip: ($('#bkZip') || {}).value || '',
      notes: ($('#bkNotes') || {}).value || ''
    };
  }

  function validateForm() {
    collectForm();
    var f = state.form;
    if (!f.firstName.trim()) return 'Please enter your first name.';
    if (!f.lastName.trim()) return 'Please enter your last name.';
    if (!f.email.trim() || f.email.indexOf('@') === -1) return 'Please enter a valid email.';
    if (!f.address.trim()) return 'Please enter your street address.';
    if (!f.city.trim()) return 'Please enter your city.';
    if (!f.state.trim()) return 'Please enter your state.';
    if (!f.zip.trim()) return 'Please enter your ZIP code.';
    return null;
  }


  function sendBooking() {
    var err = validateForm();
    if (err) {
      alert(err);
      return;
    }

    var submitBtn = $('#bookSubmitBtn');
    if (submitBtn) {
      submitBtn.classList.remove('is-success');
      submitBtn.classList.add('is-loading');
      submitBtn.disabled = true;
    }

    var payload = {
      to_email: 'support@callholden.com',
      from_name: state.form.firstName + ' ' + state.form.lastName,
      from_email: state.form.email,
      service_category: state.category,
      service_name: state.service ? state.service.name : '',
      service_price: state.service ? '$' + state.service.price.toFixed(2) : '',
      address: state.form.address,
      city: state.form.city,
      state: state.form.state,
      zip: state.form.zip,
      notes: state.form.notes || '(none)',
      message: buildEmailBody()
    };

    function finishSuccess() {
      // Turn button green with checkmark briefly
      if (submitBtn) {
        submitBtn.classList.remove('is-loading');
        submitBtn.classList.add('is-success');
        submitBtn.innerHTML = '<svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="width:20px;height:20px;vertical-align:middle;margin-right:6px;"><path d="M20 6 9 17l-5-5"/></svg> Sent';
      }
      // Then show confirmation step
      setTimeout(function () {
        goToStep(4);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.classList.remove('is-success');
          submitBtn.textContent = 'Book Service';
          submitBtn.innerHTML = 'Book Service';
        }
      }, 900);
    }

    // Try EmailJS first
    if (typeof emailjs !== 'undefined' && EMAILJS_PUBLIC_KEY !== 'YOUR_PUBLIC_KEY') {
      emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, payload)
        .then(function () { finishSuccess(); })
        .catch(function (e) {
          console.error(e);
          fallbackMailto(payload);
          finishSuccess();
        });
    } else {
      // Simulate short loading then success (mailto fallback)
      setTimeout(function () {
        fallbackMailto(payload);
        finishSuccess();
      }, 700);
    }
  }

  function buildEmailBody() {
    var f = state.form;
    var s = state.service || {};
    return [
      'NEW BOOKING REQUEST',
      '====================',
      'Service: ' + (s.name || '') + ' (' + state.category + ')',
      'Price: $' + (s.price ? s.price.toFixed(2) : ''),
      '',
      'Customer: ' + f.firstName + ' ' + f.lastName,
      'Email: ' + f.email,
      'Address: ' + f.address,
      'City: ' + f.city + ', ' + f.state + ' ' + f.zip,
      '',
      'Additional info:',
      f.notes || '(none)'
    ].join('\n');
  }

  function fallbackMailto(payload) {
    var subject = encodeURIComponent('Booking Request – ' + (state.service ? state.service.name : 'Service'));
    var body = encodeURIComponent(buildEmailBody());
    window.location.href = 'mailto:support@callholden.com?subject=' + subject + '&body=' + body;
  }

  // Event binding
  document.addEventListener('DOMContentLoaded', function () {
    // Open buttons
    $$('a[href="#schedule"], a[href="contact.html"], .eco-button-blue, .eco-button-green').forEach(function (btn) {
      var text = (btn.textContent || '').toLowerCase();
      if (text.indexOf('book') !== -1 || text.indexOf('schedule') !== -1 || btn.getAttribute('href') === '#schedule') {
        btn.addEventListener('click', function (e) {
          // Only intercept if it's a book/schedule action (not tel: or mailto:)
          var href = btn.getAttribute('href') || '';
          if (href.indexOf('tel:') === 0 || href.indexOf('mailto:') === 0) return;
          e.preventDefault();
          openModal();
        });
      }
    });

    // Also explicit book triggers
    $$('[data-book], .js-open-book').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        openModal();
      });
    });

    var overlay = $('#bookOverlay');
    if (!overlay) return;

    // Close
    var closeBtn = $('#bookClose');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });

    // Step 1 – category
    $$('.book-option').forEach(function (opt) {
      opt.addEventListener('click', function () {
        state.category = opt.getAttribute('data-category');
        goToStep(2);
      });
    });

    // Back buttons
    $$('[data-book-back]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var to = parseInt(btn.getAttribute('data-book-back'), 10);
        goToStep(to);
      });
    });


    // Submit
    var submitBtn = $('#bookSubmitBtn');
    if (submitBtn) {
      submitBtn.addEventListener('click', function (e) {
        e.preventDefault();
        sendBooking();
      });
    }

    // Done
    var doneBtn = $('#bookDoneBtn');
    if (doneBtn) doneBtn.addEventListener('click', closeModal);
  });

  // Expose for external triggers
  window.HoldenBooking = { open: openModal, close: closeModal };

  // Mobile: swipe right on success panel to close
  document.addEventListener('DOMContentLoaded', function () {
    var startX = 0;
    var panel = null;

    document.body.addEventListener('touchstart', function (e) {
      panel = document.getElementById('bookSuccessPanel');
      if (!panel || !panel.closest('.book-step.active')) return;
      if (e.touches.length === 1) startX = e.touches[0].clientX;
    }, { passive: true });

    document.body.addEventListener('touchend', function (e) {
      if (!panel || !panel.closest('.book-step.active')) return;
      var endX = e.changedTouches[0].clientX;
      var dx = endX - startX;
      // Swipe right threshold
      if (dx > 80) {
        panel.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        panel.style.transform = 'translateX(120%)';
        panel.style.opacity = '0';
        setTimeout(function () {
          closeModal();
          panel.style.transform = '';
          panel.style.opacity = '';
          panel.style.transition = '';
        }, 280);
      }
    }, { passive: true });
  });

})();
