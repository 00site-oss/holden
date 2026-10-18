/**
 * Holden – apply saved admin config to the live public page.
 * Include this AFTER the main markup, and after config.js:
 *   <script src="config.js"></script>
 *   <script src="apply-config.js"></script>
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
    // rebuild accent gradient
    if (c.accent && c.accentLight) {
      root.style.setProperty("--gradient-green", "linear-gradient(105deg, " + c.accentLight + ", " + c.accent + ")");
      root.style.setProperty("--gradient-accent", "linear-gradient(105deg, " + c.accentLight + ", " + c.accent + ")");
    }
  }

  function applyContact(contact) {
    if (!contact) return;
    // All tel: links
    document.querySelectorAll('a[href^="tel:"]').forEach((a) => {
      a.setAttribute("href", contact.phoneTel || "tel:comingsoon");
      // Update button text when it contains "Call Now"
      if (a.textContent.trim().toLowerCase().includes("call now") || a.classList.contains("eco-button-green")) {
        // keep icon, replace text nodes carefully
        const text = a.closest(".footer-call") ? null : a;
      }
    });

    // Footer big phone display
    const footerStrong = document.querySelector(".footer-call strong");
    if (footerStrong) footerStrong.textContent = contact.phoneDisplay || "Coming Soon";

    // Header "Call Now n/a" style button – leave label, just fix href (already done)

    // Email links
    document.querySelectorAll('a[href^="mailto:"]').forEach((a) => {
      const subject = a.href.includes("subject=") ? a.href.split("subject=")[1] : "";
      a.href = "mailto:" + (contact.email || "") + (subject ? "?subject=" + subject : "");
    });

    // Footer email text
    const emailPs = document.querySelectorAll(".footer-grid p");
    emailPs.forEach((p) => {
      if (p.textContent.includes("@")) {
        // keep the svg, replace text
        const svg = p.querySelector("svg");
        p.innerHTML = "";
        if (svg) p.appendChild(svg);
        p.appendChild(document.createTextNode(contact.email || ""));
      }
      if (p.textContent.includes("Ryan") || p.textContent.includes("Silverton")) {
        const svg = p.querySelector("svg");
        p.innerHTML = "";
        if (svg) p.appendChild(svg);
        p.appendChild(document.createTextNode(contact.address || ""));
      }
    });
  }

  function applyHero(hero) {
    if (!hero) return;
    const strong = document.querySelector(".hero-offer > strong");
    if (strong) strong.textContent = hero.offerAmount || strong.textContent;
    const o2 = document.querySelector(".hero-offer .o2");
    if (o2) {
      // first text node + small
      const small = o2.querySelector("small");
      o2.childNodes.forEach((n) => {
        if (n.nodeType === 3) n.textContent = (hero.offerText || "") + " ";
      });
      if (small) small.textContent = hero.offerSub || small.textContent;
    }
  }

  function applyDeals(deals) {
    if (!Array.isArray(deals) || !deals.length) return;
    const grid = document.querySelector(".deal-grid");
    if (!grid) return;
    grid.innerHTML = "";
    deals.forEach((d) => {
      const a = document.createElement("a");
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
    const cards = document.querySelectorAll(".service-card");
    const map = ["plumbing", "drain", "electrical", "hvac"];
    cards.forEach((card, i) => {
      const key = map[i];
      if (!key || !services[key]) return;
      const p = card.querySelector("p");
      if (p) p.textContent = services[key];
    });
  }

  function applyAbout(about) {
    if (!about) return;
    const section = document.getElementById("about");
    if (!section) return;
    const h2 = section.querySelector("h2");
    if (h2 && about.title) h2.textContent = about.title;
    const ps = section.querySelectorAll(".split > div:first-child > p");
    if (ps[0] && about.p1) ps[0].textContent = about.p1;
    if (ps[1] && about.p2) ps[1].textContent = about.p2;
  }

  function applyMembership(mem) {
    if (!mem) return;
    const section = document.getElementById("membership");
    if (!section) return;
    const h2 = section.querySelector("h2");
    if (h2 && mem.title) h2.textContent = mem.title;
    const p = section.querySelector(".membership-inner > div > p");
    if (p && mem.body) p.textContent = mem.body;
  }

  function applySeo(seo) {
    if (!seo) return;
    if (seo.title) document.title = seo.title;
    const desc = document.querySelector('meta[name="description"]');
    if (desc && seo.description) desc.setAttribute("content", seo.description);
    const can = document.querySelector('link[rel="canonical"]');
    if (can && seo.canonical) can.setAttribute("href", seo.canonical);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function applyAll() {
    const cfg = getConfig();
    applyColors(cfg.colors);
    applyContact(cfg.contact);
    applyHero(cfg.hero);
    applyDeals(cfg.deals);
    applyServices(cfg.services);
    applyAbout(cfg.about);
    applyMembership(cfg.membership);
    applySeo(cfg.seo);
  }

  // Run when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyAll);
  } else {
    applyAll();
  }

  // Optional: react if admin saves in another tab
  window.addEventListener("storage", function (e) {
    if (e.key === STORAGE_KEY) applyAll();
  });
})();
