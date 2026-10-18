/**
 * Holden Heating & Cooling - Shared Site Configuration
 * This file is the single source of truth for the public site and the admin panel.
 * Admin panel writes to localStorage; the public site reads from it on every load.
 * For true multi-visitor persistence, replace the localStorage layer with a backend
 * (Firebase, Supabase, or a simple Node/PHP endpoint that serves this JSON).
 */
window.HOLDEN_CONFIG = {
  // Theme / Colors (CSS custom properties)
  colors: {
    accent: "#E06A26",
    accentDark: "#C4591C",
    accentLight: "#F08442",
    primary: "oklch(.57 .14 245)",
    secondary: "oklch(.29 .065 252)",
    heroHighlight: "#FFB066",
    financingNavy: "#0F2A47"
  },

  // Contact
  contact: {
    phoneDisplay: "Coming Soon",
    phoneTel: "tel:comingsoon",
    email: "s5033510404@gmail.com",
    address: "1455 Ryan Dr, Silverton OR 97381"
  },

  // Hero
  hero: {
    offerAmount: "$500",
    offerText: "in Heating & Cooling Repairs",
    offerSub: "with the installation of a new high-efficiency system"
  },

  // Deals (array – admin can CRUD)
  deals: [
    { priceLabel: "Only", price: "$XX", title: "Drain Special", subtitle: "Drain clearing offer", tone: "tone-0" },
    { priceLabel: "Only", price: "$XX", title: "A/C or Furnace", subtitle: "Clean & check", tone: "tone-1" },
    { priceLabel: "Up to", price: "$XXXX", title: "Repair Buyback", subtitle: "On your new HVAC system", tone: "tone-2" },
    { priceLabel: "Only", price: "$XX", title: "Sump Pump", subtitle: "Inspection", tone: "tone-0" },
    { priceLabel: "Only", price: "$XX", title: "Water Heater", subtitle: "Clean & check", tone: "tone-1" }
  ],

  // Services short descriptions
  services: {
    plumbing: "Expert leak repairs, broken pipes, water heaters, and new plumbing systems from experienced local plumbers.",
    drain: "Clear stubborn blockages and restore clean, dependable flow throughout your home's plumbing system.",
    electrical: "Licensed electrical repairs and installations designed to make your home safer, brighter, and more efficient.",
    hvac: "Year-round indoor comfort with expert HVAC repairs, maintenance, and high-efficiency system installation."
  },

  // About
  about: {
    title: "Serving Customers and Helping Others Build a Life in the Trades",
    p1: "Holden was built by people who believe skilled trades create better homes and stronger communities. Our local team brings determination, honesty, and years of hands-on experience to every call.",
    p2: "Today, we are proud to be a trusted home service company for families throughout the Portland area."
  },

  // Membership
  membership: {
    title: "Unmatched Service & Exclusive Savings for Your Home",
    body: "Enjoy priority scheduling, service discounts, annual system checks, exclusive offers, and a workmanship guarantee—everything designed to keep your home efficient and worry-free."
  },

  // SEO (used by index.html head)
  seo: {
    title: "Holden Heating & Cooling | HVAC, Plumbing & Electrical in Portland, OR",
    description: "Dependable HVAC, plumbing, and electrical services in Portland, OR and surrounding metro areas. Same-day service available. Call 503-351-0404 today!",
    canonical: "https://callholden.com/"
  }
};
