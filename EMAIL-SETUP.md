# Free Email Confirmation Setup

The booking form can send confirmation emails to both the customer and the owner (`support@callholden.com`).

## Recommended Free Option: EmailJS

1. Go to https://www.emailjs.com and create a free account (200 emails/month free).
2. Add an **Email Service**:
   - Choose Gmail (or Outlook, etc.)
   - Connect your Google account (or the account you want to send from).
3. Create an **Email Template**:
   - Use variables such as:
     - `{{to_email}}`
     - `{{from_name}}`
     - `{{from_email}}`
     - `{{message}}`
     - `{{service_list}}`
     - `{{service_total}}`
   - Example template body:
     ```
     New booking from {{from_name}} ({{from_email}})

     {{message}}
     ```
4. Copy your:
   - Public Key
   - Service ID
   - Template ID
5. Open `js/booking.js` and replace:
   ```js
   var EMAILJS_PUBLIC_KEY = 'YOUR_PUBLIC_KEY';
   var EMAILJS_SERVICE_ID = 'YOUR_SERVICE_ID';
   var EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';
   ```

After that, every booking will:
- Email the full details to **support@callholden.com**
- Email a confirmation to the **customer**

## Alternative Free Options

- **Web3Forms** (https://web3forms.com) – free, no account required for basic use
- **Formspree** (https://formspree.io) – free tier available

Until the keys are added, the form falls back to opening the user’s email app with the booking details pre-filled.
