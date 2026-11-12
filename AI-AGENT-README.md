# Holden AI Agent Widget

A modern circular floating AI assistant has been added to the site.

## Features
- Circular button with Holden logo (bottom-right)
- Opens a chat panel
- Answers questions about services, pricing, areas, offers
- Always shows the phone number: **971-677-0201**
- Helps users send messages via email (`support@callholden.com`) or directs to the booking form
- Quick action buttons for common questions
- Works on all major pages (index, services, contact, about, offers, service areas, heating-cooling, and individual repair pages)
- Dedicated Service Showcase page: `services-showcase.html` with the 4 interactive service cards

## How messaging works
- User can type a request or click "Send Message"
- Agent provides direct phone link + mailto link + booking form link
- Existing EmailJS booking form on the site (see EMAIL-SETUP.md) can be fully activated with your keys

## Files added/modified
- `css/ai-agent.css` — widget styles
- `js/ai-agent.js` — widget logic + knowledge base
- `services-showcase.html` — new service cards page
- `logo-circle.png` — circular logo for the widget
- Widget CSS/JS included on all main HTML pages
