# PrimeNest Realty — Version 3.0

A **runnable full-stack real estate demonstration** built with Node.js (no npm dependencies), vanilla HTML/CSS/JavaScript and a persistent JSON database. Its warm editorial design uses cream, terracotta and charcoal, with light/dark mode.

## Quick start

1. Install **Node.js 18+** from https://nodejs.org.
2. Extract the ZIP and open a terminal in the `primenest-realty` folder (the folder containing `package.json`).
3. Run `npm start`.
4. Visit **http://localhost:3000**.

Optional: Set `PORT=3001` (PowerShell: `$env:PORT=3001`) before running to change ports. No `npm install` is necessary.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | admin@primenest.demo | Admin123! |
| Agent | agent@primenest.demo | Agent123! |
| Customer | customer@primenest.demo | Customer123! |

Public registration creates **customer** accounts only. Only admins and agents may add, edit or delete listings, or see operations analytics. Accounts and session tokens are for **local demonstration only**. Do not expose this server to the public internet without production-grade session storage, rate limits, TLS, CSRF protection, security review, and a proper database.

## Features

- Animated landing page with editorial hero, featured listings and responsive property cards.
- Light/dark theme toggle (saved in the browser).
- Browse 150 seed listings across 10 cities (80 sale / 70 rent); filter by city, transaction, max budget and bedrooms; sort by price.
- City-level pin map using Leaflet + OpenStreetMap. City pins are **approximate city centres, NOT property coordinates**. Map tiles require internet access.
- Comparison table for up to four properties.
- Saved homes / wishlist for signed-in users, persisted in `data/db.json`.
- Strict property matching against the database with transparent illustrative scores. Searches may return zero results.
- Guided "concierge" with basic English-language intent parsing and exact matching to available records. **It is rule-based, not connected to a commercial LLM**. Complex language is not reliably understood.
- Admin and agent dashboards with city inventory chart, saved actions, enquiries and visit requests.
- Property gallery with up to 12 HTTPS image URLs; displayed images require connectivity to external hosts and appropriate usage rights.
- Admin/agent CRUD (add, edit, delete) with persistent JSON storage.
- Customer and staff logins, registration, and role checks.
- Property visit requests with requested date and time, status updates by staff. Booking requests are **not automatically confirmed**.
- Property enquiry form and staff enquiry list.

## Sample data, persistence, and upgrade safety

`data/seed.json` contains the original 150 **fictional** properties. `data/db.json` is the live local database. The app migrates earlier seed databases to version 2 without replacing existing user-created properties and enquiries. Added users, favorites, visits and galleries are introduced automatically on first launch. To reset a fresh demo, stop the server, delete `data/db.json`, and restart: it will recreate the database from `data/seed.json`.

For **upgrading your own existing installation**, back up and preserve your current `data/db.json`, and replace code files from this ZIP. Do not overwrite your existing `data/db.json` with the packaged demo copy, otherwise you will lose your custom edits. The local file database is intended for demonstrations, not concurrent production usage.

## API overview

- `GET /api/properties`, `POST /api/properties`, `PUT /api/properties/:id`, `DELETE /api/properties/:id`
- `POST /api/match` and `POST /api/concierge`
- `GET /api/stats`, `GET /api/map`, `GET /api/overview`
- `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me`, `POST /api/auth/logout`
- `GET /api/favorites`, `POST /api/favorites` (toggles favorites)
- `GET /api/visits`, `POST /api/visits`, `PATCH /api/visits/:id`
- `GET /api/enquiries`, `POST /api/enquiries`

Authenticated APIs require `Authorization: Bearer <token>`. Role-restricted routes enforce permissions server-side.

## Matching rule

A result must pass every supplied hard constraint: buy/rent purpose, city, type, maximum budget, optional minimum price, minimum bedrooms, and parking if required. After filtering, an illustrative rule-based ranking score can order results. It is **not a probability or trained AI model**. To verify quickly, try Pune / Sale / maximum 80 lakh / 2 bedrooms / parking required (four matches in the seed catalogue).

## Notes

No commercial property data, maps of exact private addresses, external AI API, payments, email delivery, or real booking confirmation is included. Listing photos are illustrative external links, not evidence of the fictional properties. This app is designed for a classroom project and a local prototype.
