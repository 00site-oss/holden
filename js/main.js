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
})();
