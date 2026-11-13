# Holden AI Agent Widget

A modern circular floating AI assistant has been added to the site.

## Features
- Circular button with Holden logo (bottom-right)
- Opens a chat panel with receptionist **Anna**
- Follows a professional, empathetic conversation flow to collect service details and schedule appointments
- Collects: issue description, full name (with spelling confirmation), phone, email, full Oregon address, preferred date/time
- Restricts service to Oregon only
- Always shows the phone number: **971-677-0201**
- Helps users send messages via email (`support@callholden.com`) or directs to the booking form
- Quick action buttons for common questions and starting a booking
- Works on all major pages (index, services, contact, about, offers, service areas, heating-cooling, and individual repair pages)

## How the receptionist flow works
1. Greeting and ask about the issue
2. Listen to problem description
3. Collect and confirm name
4. Collect phone and email
5. Collect full service address (Oregon only)
6. Preferred scheduling window
7. Verify all details and ask for anything missing
8. Summarize and confirm that email + text confirmation will be sent
9. Professional closing

## How messaging works
- User can type a request or click quick actions
- Agent provides direct phone link + mailto link + booking form link
- Existing EmailJS booking form on the site (see EMAIL-SETUP.md) can be fully activated with your keys

## Files added/modified
- `css/ai-agent.css` — widget styles
- `js/ai-agent.js` — widget logic + receptionist conversation flow
- `logo-circle.png` — circular logo for the widget
- Widget CSS/JS included on all main HTML pages
