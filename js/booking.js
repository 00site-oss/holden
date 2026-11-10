(function () {
  'use strict';

  // ========== CONFIG – replace with your EmailJS keys ==========
  var EMAILJS_PUBLIC_KEY = 'YOUR_PUBLIC_KEY';
  var EMAILJS_SERVICE_ID = 'YOUR_SERVICE_ID';
  var EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';
  // =============================================================

  var state = {
    step: 1,
    category: '',
    services: [],   // array of selected services
    form: {},
    photos: []
  };

  var catalog = {
    'AC Repair': [
      { name: 'Air Conditioning System Diagnostic', price: 89, desc: 'Professional system evaluation to identify the root cause of your cooling issue.' },
      { name: 'Air Conditioner Tune-Up & Safety Inspection', price: 89, desc: 'Comprehensive maintenance and safety inspection for your AC system.' },
      { name: 'Air Conditioner & Furnace Tune-Up', price: 89, desc: 'Combined AC & furnace tune-up for complete seasonal maintenance.' }
    ],
    'Furnace Repair': [
      { name: 'Furnace Diagnostic', price: 89, desc: 'Full diagnostic to find the cause of heating problems.' },
      { name: 'Furnace Tune-Up & Safety Inspection', price: 89, desc: 'Complete furnace maintenance and safety check.' },
      { name: 'Furnace & AC Tune-Up Combo', price: 89, desc: 'Both systems tuned up in one visit.' }
    ],
    'Heat Pump Repair': [
      { name: 'Heat Pump Diagnostic', price: 89, desc: 'Expert evaluation of your heat pump system.' },
      { name: 'Heat Pump Tune-Up', price: 89, desc: 'Seasonal maintenance for optimal heat pump performance.' },
      { name: 'A/C & Heat Pump Tune-Up Special', price: 89, desc: 'Limited time dual-system tune-up offer.' }
    ],
    'Commercial Service': [
      { name: 'Commercial System Diagnostic', price: 149, desc: 'Diagnostic service for light commercial HVAC equipment.' },
      { name: 'Commercial Maintenance Visit', price: 179, desc: 'Scheduled maintenance for commercial systems.' }
    ]
  };

  
  // Override catalog with admin-saved data if available
  if (window.__holdenBookingCatalog) {
    catalog = window.__holdenBookingCatalog;
  }

function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function openModal() {
    var overlay = $('#bookOverlay');
    if (!overlay) return;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    // keep existing cart if user is adding more; only reset when fully closed
    if (!state.services.length) {
      state = { step: 1, category: '', services: [], form: {}, photos: [] };
    }
    goToStep(state.services.length ? 1 : 1);
  }

  function closeModal() {
    var overlay = $('#bookOverlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    state = { step: 1, category: '', services: [], form: {}, photos: [] };
    var thumbs = $('#bookThumbs');
    if (thumbs) thumbs.innerHTML = '';
    var cart = $('#bookCart');
    if (cart) cart.innerHTML = '';
  }

  function goToStep(n) {
    state.step = n;
    $$('.book-step').forEach(function (el) { el.classList.remove('active'); });
    var stepEl = $('#bookStep' + n);
    if (stepEl) stepEl.classList.add('active');

    var bar = $('#bookProgressBar');
    if (bar) bar.style.width = (n * 25) + '%';

    if (n === 2) renderServices();
    if (n === 3) {
      renderCart();
      renderSummary();
    }
  }

  function renderServices() {
    var list = $('#bookServiceList');
    if (!list) return;
    var items = catalog[state.category] || [];
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
        var svc = catalog[state.category][parseInt(el.getAttribute('data-index'), 10)];
        // Add to cart (allow duplicates only if different category name combo)
        state.services.push({
          category: state.category,
          name: svc.name,
          price: svc.price,
          desc: svc.desc
        });
        setTimeout(function () { goToStep(3); }, 180);
      });
    });
  }

  function renderCart() {
    var cart = $('#bookCart');
    if (!cart) return;
    if (!state.services.length) {
      cart.innerHTML = '';
      return;
    }
    cart.innerHTML = state.services.map(function (s, i) {
      return '<span class="book-chip">' + s.name + ' · $' + s.price.toFixed(2) +
        ' <button type="button" data-remove="' + i + '" aria-label="Remove">&times;</button></span>';
    }).join('');

    $$('[data-remove]', cart).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-remove'), 10);
        state.services.splice(idx, 1);
        renderCart();
        renderSummary();
      });
    });
  }

  function renderSummary() {
    var box = $('#bookSummary');
    if (!box) return;
    if (!state.services.length) {
      box.innerHTML = '<span style="color:#888">No services selected yet.</span>';
      return;
    }
    var total = state.services.reduce(function (sum, s) { return sum + s.price; }, 0);
    box.innerHTML = '<strong>' + state.services.length + ' service(s)</strong> &nbsp;·&nbsp; Total <strong>$' + total.toFixed(2) + '</strong>';
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
    if (!state.services.length) return 'Please select at least one service.';
    if (!f.firstName.trim()) return 'Please enter your first name.';
    if (!f.lastName.trim()) return 'Please enter your last name.';
    if (!f.email.trim() || f.email.indexOf('@') === -1) return 'Please enter a valid email.';
    if (!f.address.trim()) return 'Please enter your street address.';
    if (!f.city.trim()) return 'Please enter your city.';
    if (!f.state.trim()) return 'Please enter your state.';
    if (!f.zip.trim()) return 'Please enter your ZIP code.';
    return null;
  }

  function buildEmailBody() {
    var f = state.form;
    var lines = [
      'NEW BOOKING REQUEST',
      '====================',
      ''
    ];
    state.services.forEach(function (s, i) {
      lines.push((i + 1) + '. ' + s.name + ' (' + s.category + ') – $' + s.price.toFixed(2));
    });
    var total = state.services.reduce(function (sum, s) { return sum + s.price; }, 0);
    lines.push('Total: $' + total.toFixed(2));
    lines.push('');
    lines.push('Customer: ' + f.firstName + ' ' + f.lastName);
    lines.push('Email: ' + f.email);
    lines.push('Address: ' + f.address);
    lines.push('City: ' + f.city + ', ' + f.state + ' ' + f.zip);
    lines.push('');
    lines.push('Additional info:');
    lines.push(f.notes || '(none)');
    if (state.photos.length) {
      lines.push('');
      lines.push('Photos attached: ' + state.photos.length);
    }
    return lines.join('\n');
  }

  function fallbackMailto() {
    var subject = encodeURIComponent('Booking Request – Holden HVAC');
    var body = encodeURIComponent(buildEmailBody());
    window.location.href = 'mailto:support@callholden.com?subject=' + subject + '&body=' + body;
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

    var total = state.services.reduce(function (sum, s) { return sum + s.price; }, 0);
    var payload = {
      to_email: 'support@callholden.com',
      from_name: state.form.firstName + ' ' + state.form.lastName,
      from_email: state.form.email,
      service_list: state.services.map(function (s) { return s.name + ' ($' + s.price.toFixed(2) + ')'; }).join(', '),
      service_total: '$' + total.toFixed(2),
      address: state.form.address,
      city: state.form.city,
      state: state.form.state,
      zip: state.form.zip,
      notes: state.form.notes || '(none)',
      photo_count: String(state.photos.length),
      message: buildEmailBody()
    };

    function finishSuccess() {
      if (submitBtn) {
        submitBtn.classList.remove('is-loading');
        submitBtn.classList.add('is-success');
        submitBtn.innerHTML = '<svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="width:20px;height:20px;vertical-align:middle;margin-right:6px;"><path d="M20 6 9 17l-5-5"/></svg> Sent';
      }
      setTimeout(function () {
        goToStep(4);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.classList.remove('is-success');
          submitBtn.textContent = 'Book Service';
        }
      }, 900);
    }

    if (typeof emailjs !== 'undefined' && EMAILJS_PUBLIC_KEY !== 'YOUR_PUBLIC_KEY') {
      emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, payload)
        .then(function () { finishSuccess(); })
        .catch(function (e) {
          console.error(e);
          fallbackMailto();
          finishSuccess();
        });
    } else {
      setTimeout(function () {
        fallbackMailto();
        finishSuccess();
      }, 700);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Open booking from Book / Schedule buttons
    $$('a[href="#schedule"], a[href="contact.html"], .eco-button-blue, .eco-button-green').forEach(function (btn) {
      var text = (btn.textContent || '').toLowerCase();
      if (text.indexOf('book') !== -1 || text.indexOf('schedule') !== -1 || btn.getAttribute('href') === '#schedule') {
        btn.addEventListener('click', function (e) {
          var href = btn.getAttribute('href') || '';
          if (href.indexOf('tel:') === 0 || href.indexOf('mailto:') === 0) return;
          e.preventDefault();
          openModal();
        });
      }
    });
    $$('[data-book], .js-open-book').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        openModal();
      });
    });

    var overlay = $('#bookOverlay');
    if (!overlay) return;

    var closeBtn = $('#bookClose');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });

    $$('.book-option').forEach(function (opt) {
      opt.addEventListener('click', function () {
        state.category = opt.getAttribute('data-category');
        goToStep(2);
      });
    });

    $$('[data-book-back]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        goToStep(parseInt(btn.getAttribute('data-book-back'), 10));
      });
    });

    // Add more services – go back to category list, keep cart
    var addMore = $('#bookAddMore');
    if (addMore) {
      addMore.addEventListener('click', function () {
        goToStep(1);
      });
    }

    var submitBtn = $('#bookSubmitBtn');
    if (submitBtn) {
      submitBtn.addEventListener('click', function (e) {
        e.preventDefault();
        sendBooking();
      });
    }

    var doneBtn = $('#bookDoneBtn');
    if (doneBtn) doneBtn.addEventListener('click', closeModal);

    // Photo upload
    var uploadArea = $('#bookUploadArea');
    var fileInput = $('#bkPhotos');
    var thumbs = $('#bookThumbs');
    if (uploadArea && fileInput) {
      uploadArea.addEventListener('click', function () { fileInput.click(); });
      fileInput.addEventListener('change', function () {
        var files = Array.prototype.slice.call(fileInput.files || []);
        files.forEach(function (file) {
          if (!file.type.match(/^image\//)) return;
          state.photos.push(file);
          if (thumbs) {
            var reader = new FileReader();
            reader.onload = function (ev) {
              var img = document.createElement('img');
              img.src = ev.target.result;
              img.alt = 'Upload preview';
              thumbs.appendChild(img);
            };
            reader.readAsDataURL(file);
          }
        });
      });
    }

    // Mobile swipe right on success to close
    var startX = 0;
    document.body.addEventListener('touchstart', function (e) {
      var panel = document.getElementById('bookSuccessPanel');
      if (!panel || !panel.closest('.book-step.active')) return;
      if (e.touches.length === 1) startX = e.touches[0].clientX;
    }, { passive: true });
    document.body.addEventListener('touchend', function (e) {
      var panel = document.getElementById('bookSuccessPanel');
      if (!panel || !panel.closest('.book-step.active')) return;
      var dx = e.changedTouches[0].clientX - startX;
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

  window.HoldenBooking = { open: openModal, close: closeModal };
})();
