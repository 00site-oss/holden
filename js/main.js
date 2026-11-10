(function () {
  'use strict';

  // ===== Mobile nav toggle =====
  var toggle = document.getElementById('navToggle');
  var nav = document.getElementById('siteNav');
  if (toggle && nav) {
    var iconMenu = toggle.querySelector('.icon-menu');
    var iconX = toggle.querySelector('.icon-x');
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (iconMenu) iconMenu.style.display = open ? 'none' : 'block';
      if (iconX) iconX.style.display = open ? 'block' : 'none';
    });
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        if (iconMenu) iconMenu.style.display = 'block';
        if (iconX) iconX.style.display = 'none';
      });
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 900) {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        if (iconMenu) iconMenu.style.display = 'block';
        if (iconX) iconX.style.display = 'none';
      }
    });
  }

  // ===== Areas "Load More" toggle =====
  var areasToggle = document.getElementById('areasToggle');
  var areasList = document.getElementById('areasList');
  if (areasToggle && areasList) {
    areasToggle.addEventListener('click', function () {
      var hiddenItems = areasList.querySelectorAll('li[hidden]');
      if (hiddenItems.length) {
        hiddenItems.forEach(function (el) { el.removeAttribute('hidden'); });
        areasToggle.childNodes[0].nodeValue = 'Show Fewer Areas';
      } else {
        var allItems = areasList.querySelectorAll('li');
        for (var i = 20; i < allItems.length; i++) {
          allItems[i].setAttribute('hidden', '');
        }
        areasToggle.childNodes[0].nodeValue = 'Load More Areas';
      }
    });
  }

  // ===== Return to homepage only when user is at the very top and tries to scroll up again =====
  // This allows free scrolling up/down to read content.
  // Only triggers when already at the top + additional upward intention.

  var isHomePage = window.location.pathname.endsWith('index.html') ||
                   window.location.pathname === '/' ||
                   window.location.pathname === '' ||
                   window.location.pathname.endsWith('/');

  if (!isHomePage) {
    var atTop = window.scrollY <= 5;
    var pullDistance = 0;
    var startY = 0;
    var isPulling = false;

    // Track whether we are at the top
    window.addEventListener('scroll', function () {
      atTop = window.scrollY <= 5;
      if (!atTop) {
        pullDistance = 0;
      }
    }, { passive: true });

    // Desktop: mouse wheel upward while already at top
    window.addEventListener('wheel', function (e) {
      if (atTop && e.deltaY < 0) {
        // User is at top and scrolling up → go home
        window.location.href = 'index.html';
      }
    }, { passive: true });

    // Mobile: touch pull-down while at top
    window.addEventListener('touchstart', function (e) {
      if (atTop && e.touches.length === 1) {
        startY = e.touches[0].clientY;
        isPulling = true;
        pullDistance = 0;
      }
    }, { passive: true });

    window.addEventListener('touchmove', function (e) {
      if (!isPulling || !atTop) return;
      var currentY = e.touches[0].clientY;
      pullDistance = currentY - startY;

      // If user pulls down more than 80px while at the top → go home
      if (pullDistance > 80) {
        isPulling = false;
        window.location.href = 'index.html';
      }
    }, { passive: true });

    window.addEventListener('touchend', function () {
      isPulling = false;
      pullDistance = 0;
    }, { passive: true });
  }
})();
