# PrimeNest Realty — Share on the Web

## Public demo on Render

1. Create a GitHub repository (private is fine) and upload **the contents of this `primenest-realty` directory** so `package.json`, `server.js`, and `render.yaml` are at repository root. Do not upload any existing customer information.
2. In Render Dashboard click **New > Web Service**, connect the GitHub repo.
3. Choose **Node** / Free plan, `npm install` as build command, `npm start` as start command.
4. Deploy; Render will assign a unique public `https://...onrender.com` link. Share that link; it will work on mobile/desktop.

## Crucial limitations and precautions

- This is a **classroom-only prototype, not a secure public production service**. It contains built-in demo users/passwords, example account/session implementation, and a JSON database; anyone who finds public demo credentials could use demo administrative functions. **Never add real personal or customer data.** Do not use the built-in administrative accounts for anything important.
- On Render Free, local JSON changes (including registrations, added property listings, saved properties and visit requests) will be lost when the server spins down or redeploys. The 150 fictional initial listings return from the seed database. A permanent app requires an external persistent database and security upgrades.
- Free instances may become inactive when idle; the first visit after inactivity may take time to start.
- Listing images depend on external image URLs; maps depend on online tile providers.
- For a serious public version: remove public demo credentials, implement robust authentication and access management, anti-abuse rate limits and CSRF protection as applicable, production database and backups, and reviewed image licensing.

Local run: `npm start` then `http://localhost:3000`.
