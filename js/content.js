(function () {
  'use strict';

  var KEY = 'holden_content_v1';

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function apply(data) {
    if (!data) return;

    // Phone
    if (data.phone) {
      document.querySelectorAll('a[href^="tel:"]').forEach(function (a) {
        var text = a.textContent || '';
        if (text.match(/971|Call/i)) {
          a.textContent = text.replace(/971[\d-]+/, data.phone);
        }
        a.href = 'tel:+1' + data.phone.replace(/\D/g, '');
      });
    }

    // Email
    if (data.email) {
      document.querySelectorAll('a[href^="mailto:"], p').forEach(function (el) {
        if ((el.textContent || '').indexOf('@') !== -1 && (el.textContent || '').indexOf('support') !== -1) {
          el.textContent = el.textContent.replace(/[\w.+-]+@[\w.-]+\.\w+/, data.email);
          if (el.tagName === 'A') el.href = 'mailto:' + data.email;
        }
      });
    }

    // Address
    if (data.address) {
      document.querySelectorAll('p, li, span').forEach(function (el) {
        if ((el.textContent || '').indexOf('Ryan Dr') !== -1 || (el.textContent || '').indexOf('Silverton') !== -1) {
          el.textContent = data.address;
        }
      });
    }

    // Hero (homepage only)
    if (data.hero && document.querySelector('.hero-headline')) {
      var h1 = document.querySelector('.hero-headline');
      if (data.hero.html) h1.innerHTML = data.hero.html;
      var sub = document.querySelector('.eco-hero-inner > p');
      if (sub && data.hero.sub) sub.textContent = data.hero.sub;
    }

    // Footer
    if (data.footer) {
      if (data.footer.copyright) {
        var copy = document.querySelector('.copyright');
        if (copy) copy.innerHTML = data.footer.copyright;
      }
    }

    // Booking services (injected into booking.js state if present)
    if (data.bookingServices && window.HoldenBooking) {
      window.HoldenBooking.setCatalog && window.HoldenBooking.setCatalog(data.bookingServices);
    }
    // Store for booking.js to pick up
    if (data.bookingServices) {
      window.__holdenBookingCatalog = data.bookingServices;
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var data = load();
    if (data) apply(data);
  });

  window.HoldenContent = {
    load: load,
    save: function (data) {
      localStorage.setItem(KEY, JSON.stringify(data));
    },
    apply: apply
  };
})();
