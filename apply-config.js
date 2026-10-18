/**
 * Holden – apply saved admin config to the live public page.
 * Also supports Edit Mode messages from admin.html iframe parent.
 */
(function () {
  const STORAGE_KEY = "holden_site_config_v1";

  function deepMerge(target, source) {
    for (const key in source) {
      if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }

  function getConfig() {
    let base = window.HOLDEN_CONFIG ? JSON.parse(JSON.stringify(window.HOLDEN_CONFIG)) : {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) base = deepMerge(base, JSON.parse(raw));
    } catch (e) {}
    return base;
  }

  function applyColors(c) {
    if (!c) return;
    const root = document.documentElement;
    if (c.accent) {
      root.style.setProperty("--accent", c.accent);
      root.style.setProperty("--green-end", c.accent);
    }
    if (c.accentDark) root.style.setProperty("--accent-dark", c.accentDark);
    if (c.accentLight) {
      root.style.setProperty("--accent-light", c.accentLight);
      root.style.setProperty("--green-start", c.accentLight);
    }
    if (c.heroHighlight) root.style.setProperty("--hero-highlight", c.heroHighlight);
    if (c.financingNavy) root.style.setProperty("--financing-navy", c.financingNavy);
    if (c.accent && c.accentLight) {
      root.style.setProperty("--gradient-green", "linear-gradient(105deg, " + c.accentLight + ", " + c.accent + ")");
      root.style.setProperty("--gradient-accent", "linear-gradient(105deg, " + c.accentLight + ", " + c.accent + ")");
    }
  }

  function applyContact(contact) {
    if (!contact) return;
    document.querySelectorAll('a[href^="tel:"]').forEach(function (a) {
      a.setAttribute("href", contact.phoneTel || "tel:comingsoon");
    });
    var footerStrong = document.querySelector(".footer-call strong");
    if (footerStrong) footerStrong.textContent = contact.phoneDisplay || "Coming Soon";
    document.querySelectorAll('a[href^="mailto:"]').forEach(function (a) {
      var subject = a.href.indexOf("subject=") > -1 ? a.href.split("subject=")[1] : "";
      a.href = "mailto:" + (contact.email || "") + (subject ? "?subject=" + subject : "");
    });
    document.querySelectorAll(".footer-grid p").forEach(function (p) {
      if (p.textContent.indexOf("@") > -1) {
        var svg = p.querySelector("svg");
        p.innerHTML = "";
        if (svg) p.appendChild(svg);
        p.appendChild(document.createTextNode(contact.email || ""));
      }
      if (p.textContent.indexOf("Ryan") > -1 || p.textContent.indexOf("Silverton") > -1) {
        var svg2 = p.querySelector("svg");
        p.innerHTML = "";
        if (svg2) p.appendChild(svg2);
        p.appendChild(document.createTextNode(contact.address || ""));
      }
    });
  }

  function applyHero(hero) {
    if (!hero) return;
    var strong = document.querySelector(".hero-offer > strong");
    if (strong) strong.textContent = hero.offerAmount || strong.textContent;
    var o2 = document.querySelector(".hero-offer .o2");
    if (o2) {
      var small = o2.querySelector("small");
      o2.childNodes.forEach(function (n) {
        if (n.nodeType === 3) n.textContent = (hero.offerText || "") + " ";
      });
      if (small) small.textContent = hero.offerSub || small.textContent;
    }
  }

  function applyDeals(deals) {
    if (!Array.isArray(deals) || !deals.length) return;
    var grid = document.querySelector(".deal-grid");
    if (!grid) return;
    grid.innerHTML = "";
    deals.forEach(function (d) {
      var a = document.createElement("a");
      a.className = "deal";
      a.href = "#schedule";
      a.innerHTML =
        '<span class="deal-price ' + (d.tone || "tone-0") + '">' +
        "<small>" + escapeHtml(d.priceLabel || "Only") + "</small>" +
        "<b>" + escapeHtml(d.price || "$XX") + "</b></span>" +
        '<span class="deal-copy"><strong>' + escapeHtml(d.title || "") + "</strong>" +
        "<em>" + escapeHtml(d.subtitle || "") + "</em></span>";
      grid.appendChild(a);
    });
  }

  function applyServices(services) {
    if (!services) return;
    var cards = document.querySelectorAll(".service-card");
    var map = ["plumbing", "drain", "electrical", "hvac"];
    cards.forEach(function (card, i) {
      var key = map[i];
      if (!key || !services[key]) return;
      var p = card.querySelector("p");
      if (p) p.textContent = services[key];
    });
  }

  function applyAbout(about) {
    if (!about) return;
    var section = document.getElementById("about");
    if (!section) return;
    var h2 = section.querySelector("h2");
    if (h2 && about.title) h2.textContent = about.title;
    var ps = section.querySelectorAll(".split > div:first-child > p");
    if (ps[0] && about.p1) ps[0].textContent = about.p1;
    if (ps[1] && about.p2) ps[1].textContent = about.p2;
  }

  function applyMembership(mem) {
    if (!mem) return;
    var section = document.getElementById("membership");
    if (!section) return;
    var h2 = section.querySelector("h2");
    if (h2 && mem.title) h2.textContent = mem.title;
    var p = section.querySelector(".membership-inner > div > p");
    if (p && mem.body) p.textContent = mem.body;
  }

  function applySeo(seo) {
    if (!seo) return;
    if (seo.title) document.title = seo.title;
    var desc = document.querySelector('meta[name="description"]');
    if (desc && seo.description) desc.setAttribute("content", seo.description);
    var can = document.querySelector('link[rel="canonical"]');
    if (can && seo.canonical) can.setAttribute("href", seo.canonical);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function applyAll(cfg) {
    cfg = cfg || getConfig();
    applyColors(cfg.colors);
    applyContact(cfg.contact);
    applyHero(cfg.hero);
    applyDeals(cfg.deals);
    applyServices(cfg.services);
    applyAbout(cfg.about);
    applyMembership(cfg.membership);
    applySeo(cfg.seo);
  }

  window.__holdenApply = applyAll;

  // Edit Mode: make text contenteditable when parent admin enables it
  var editStyle = null;
  function setEditMode(enabled) {
    var selectors = "h1, h2, h3, p, .deal-copy strong, .deal-copy em, .deal-price b, .deal-price small, .hero-offer strong, .hero-offer .o2, .section-title, .footer-call strong";
    var nodes = document.querySelectorAll(selectors);
    nodes.forEach(function (el) {
      el.contentEditable = enabled ? "true" : "false";
      if (enabled) {
        el.style.outline = "1px dashed rgba(224,106,38,0.5)";
        el.style.cursor = "text";
      } else {
        el.style.outline = "";
        el.style.cursor = "";
      }
    });
    if (enabled && !editStyle) {
      editStyle = document.createElement("style");
      editStyle.id = "holden-edit-style";
      editStyle.textContent = "[contenteditable=true]:focus { outline: 2px solid #E06A26 !important; background: rgba(224,106,38,0.06); }";
      document.head.appendChild(editStyle);
    }
    if (!enabled && editStyle) {
      editStyle.remove();
      editStyle = null;
    }
  }

  window.addEventListener("message", function (e) {
    if (!e.data || !e.data.type) return;
    if (e.data.type === "HOLDEN_APPLY_CONFIG") {
      if (e.data.config) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(e.data.config));
        } catch (err) {}
      }
      applyAll(e.data.config || getConfig());
    }
    if (e.data.type === "HOLDEN_EDIT_MODE") {
      setEditMode(!!e.data.enabled);
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { applyAll(); });
  } else {
    applyAll();
  }

  window.addEventListener("storage", function (e) {
    if (e.key === STORAGE_KEY) applyAll();
  });
})();
