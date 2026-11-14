# React E-Commerce Store

A full-stack online store built with React, TypeScript and an Express API: product search and filters, a cart, coupons, two ways to pay, order tracking with real statuses, customer accounts with a wishlist, an admin area to run the store, English and German, and a dark mode.

**Live demo:** https://react-ecommerce-8359.onrender.com

> The demo runs on a free server that sleeps when idle, so the first visit may take about a minute to load.

![The store's home page with category filters and product cards](docs/screenshots/home.png)

## Try It

- **Pay by card** with Stripe's test card `4242 4242 4242 4242`, any future date and any CVC. No money moves.
- **Use a coupon:** type `WELCOME10` at checkout for 10% off the items. Checkout also suggests it.
- **Cancel an order** from your orders page before it ships. Its items go back in stock, and a card payment is refunded in full.
- **Sold out products:** the Straw Wide Brim Sun Hat can't be added to the cart, and the Woven Straw Tote Bag has only 2 left.
- **Create an account** to keep your cart, orders and wishlist on every device. What you added as a guest moves to the account when you log in.
- **Switch to German** with DE in the header, or **turn on dark mode** with the moon next to it. Both are remembered, and until you choose, the store follows your browser's language and your system's theme.

The admin area needs an account listed in `ADMIN_USER_IDS`, so the screenshots below show it.

## Features

**Shopping**
- Search by name or keyword, browse by category, filter by price and sort by price, rating or newest. Every filter is kept in the URL, so links and the back button work
- Product pages with verified reviews: customers who ordered a product can rate and review it, and the shop shows a masked name such as "ja\*\*\*"
- Up to 4 suggestions from the same category on every product page, best rated first, and the last 4 products this browser looked at
- A wishlist for logged in customers, saved with the heart on any product. Guests are asked to log in, and a product deleted since shows as no longer available
- Stock for every product: the shop says when only a few are left, and sold out products can't be added. Demo products that run low are restocked once a day
- A cart with quantities, three delivery options and a live payment summary
- Coupons typed at checkout, with the discount worked out by the API every time
- Order history with each order's status (processing, shipped, delivered or cancelled) and package tracking
- Cancelling an order until it ships, which puts its items back in stock and refunds a card payment
- A separate cart and order history for each visitor without signing up, or optional accounts with email and password, a password reset by email and an account page
- Notifications that confirm actions or explain what failed, with a retry, and loading, empty and error states everywhere

**Language and look**
- English and German for every page, notification and form hint, chosen in the header, remembered in the browser and taken from the browser's language at first
- Dates and numbers are written the way the language does, while prices stay in US dollars. The API sends a code with each reason a shopper can run into, so those are translated too. Rarer ones, like an admin form field the browser already checks, stay in English
- A dark mode that follows the system's theme, with a toggle in the header. Every color is a CSS variable with a light and a dark value, and the end-to-end tests check contrast in both

**Admin**
- An overview with the orders of the last 24 hours and 7 days, the week's revenue, low stock products and the 5 best sellers
- Every order in one table, filtered by status and payment, where admins mark orders shipped, delivered or cancelled
- Products to add, edit and delete, with a category, stock and one of the store's photos
- Coupons with a percentage, an optional last day, and whether checkout suggests them
- Removing any review

**Payments**
- Pay on delivery, or by card with Stripe Checkout in test mode
- The API builds every Stripe payment from the cart in the database, so nothing the browser sends sets a price, and a coupon becomes a one-time Stripe discount
- A card order is only created once Stripe confirms the payment, through the webhook or the page the customer returns to, and one payment always makes exactly one order
- Cancelling a card order refunds the whole payment first, and the order is only cancelled once Stripe accepts the refund. An idempotency key per order means a repeated cancel never refunds twice, and only payments tagged for this store are refunded

**Quality**
- Unit, API and end-to-end tests, run by GitHub Actions on every push
- Security headers, a content security policy, rate limits, body size limits and admin checks on every admin route
- Keyboard and screen reader friendly: labelled controls, visible focus, focus kept in place after changes, and an automated accessibility check in the end-to-end tests
- Lighthouse 100 for performance, accessibility, best practices and SEO on the home, product and checkout pages (local production build, mobile settings)

## Screenshots

| Product page | Checkout |
| --- | --- |
| ![A product page with its photo, rating, price and reviews](docs/screenshots/product.png) | ![Checkout with delivery options, the payment summary and a coupon field](docs/screenshots/checkout.png) |
| **Admin overview and products** | **Admin orders** |
| ![The admin overview with order counts, revenue, low stock and top products, above the product table](docs/screenshots/admin-products.png) | ![The admin orders table with filters, statuses and buttons to ship or cancel](docs/screenshots/admin-orders.png) |
| **Wishlist in dark mode** | **Product page in German** |
| ![A wishlist with four saved products, shown in dark mode](docs/screenshots/wishlist-dark.png) | ![A product page in German with its reviews and four suggested products from the same category](docs/screenshots/product-german.png) |

## Tech Stack

- **Frontend:** React 19 with the React Compiler, TypeScript, Vite, React Router, Axios, Day.js
- **Backend:** Node.js, Express, Sequelize, helmet, express-rate-limit
- **Database:** Postgres on Supabase in production, SQLite locally
- **Accounts:** Supabase Auth, with tokens verified in the API using jose
- **Payments:** Stripe Checkout in test mode
- **Testing:** Vitest and Testing Library, the Node test runner, Playwright with axe
- **Tooling and hosting:** ESLint, GitHub Actions, Render

## Architecture

```text
Browser ──────────────► Express API (Render) ─────────► Postgres (Supabase)
  React app              /api/*  JSON routes            SQLite file locally
  served by the API      /*      the built React app
     │                       │
     │ login                 │ checks tokens against Supabase's public keys
     ▼                       ▼
Supabase Auth           Stripe Checkout ◄── webhook: checkout.session.completed
```

- **One service.** In production the Express server serves both the API under `/api` and the built frontend, so they share one origin and need no CORS.
- **Visitors and accounts.** The browser makes up a visitor ID and sends it as `X-Visitor-Id`, which keeps a cart and orders per browser without an account. A logged in user sends their Supabase token instead. The API verifies it with the project's public keys and uses the user ID in place of the visitor ID.
- **The API decides.** Prices, discounts, stock, order totals, who is an admin and which status changes are allowed are all worked out on the server. The frontend only shows what the API says.
- **Stock without transactions.** The local SQLite driver can't hold a transaction open, so taking stock is a single conditional `UPDATE` per item, and an order that runs short gives back what it took. Status changes work the same way, so two cancels at once can't return stock twice.
- **Schema changes on startup.** `sync()` creates missing tables, like the wishlist's, and columns added later are added by `server.js` on startup, so a deploy upgrades the Postgres database by itself.
- **Translations in one place.** The English messages in `src/i18n/en.ts` define the type the German ones must match, so a missing or extra key fails the build. A test checks that every code the API sends has a message.

The endpoints are described in [ecommerce-backend/documentation.md](ecommerce-backend/documentation.md).

## Run Locally

Requires Node.js 22 or newer.

```bash
npm install
npm --prefix ecommerce-backend install
```

Start the backend on http://localhost:3000. It creates a SQLite database and loads the demo data on first run.

```bash
npm run dev:backend
```

In a second terminal, start the frontend on http://localhost:5173:

```bash
npm run dev
```

The dev server forwards API requests to the backend, so nothing needs configuring. Without the optional settings below, the store runs in guest-only mode with paying on delivery.

## Environment Variables

The frontend reads `.env.local` when it's built, and the backend reads `ecommerce-backend/.env` when it starts, where real environment variables win. [.env.example](.env.example) and [ecommerce-backend/.env.example](ecommerce-backend/.env.example) describe each one.

| Variable | Where | What it does |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Frontend | Supabase project URL. With the key below, turns on login |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Frontend | Supabase publishable key (`sb_publishable_...`), safe to ship to the browser |
| `VITE_API_URL` | Frontend | The API's URL, only when it's hosted apart from the frontend |
| `VITE_SITE_URL` | Frontend | The store's address for link preview images. Defaults to the live demo |
| `DATABASE_URL` | Backend | Postgres connection string. Without it, a local SQLite file is used |
| `SUPABASE_URL` | Backend | The same project URL, to verify login tokens and allow Supabase in the content security policy |
| `ADMIN_USER_IDS` | Backend | Comma-separated Supabase user IDs of the admins |
| `STRIPE_SECRET_KEY` | Backend | Stripe test key (`sk_test_...`). Without it, card payment is hidden |
| `STRIPE_WEBHOOK_SECRET` | Backend | Signing secret of the Stripe webhook (`whsec_...`) |
| `CORS_ORIGIN` | Backend | Other origins allowed to call the API. Defaults to the Vite dev server, and to none in production |
| `DEMO_RESTOCK` | Backend | `false` turns off the daily restock of demo products |
| `PORT` | Backend | Server port, 3000 by default. Render sets it |

## Testing

```bash
npm run lint && npm test && npm run build
npm --prefix ecommerce-backend run lint && npm --prefix ecommerce-backend test
```

- **Frontend unit tests** (Vitest, Testing Library) render pages and components with a stubbed API.
- **API tests** (Node test runner) start the real server on a free port with a throwaway SQLite database and call it over HTTP. Local stand-ins for Supabase Auth and the Stripe API sign their own tokens and webhook events, so no accounts or keys are needed. To run them against Postgres, set `TEST_DATABASE_URL` to an empty throwaway database, for example one started with `docker run -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:17` and `postgres://postgres:postgres@localhost:5432/postgres`. A database on `localhost` is reached without SSL.
- **End-to-end tests** (Playwright) click through a production build of the store, served by the backend on a fresh SQLite database, with a stand-in for Supabase Auth and card payment off. They cover browsing, filtering and search, related and recently viewed products, a guest order paid on delivery, coupons, stock limits, cancelling, an admin shipping an order, the wishlist, switching to German, dark mode, keyboard focus and an axe accessibility check of the pages in both themes.

```bash
npx playwright install chromium   # once
npm run test:e2e
```

The end-to-end run builds the frontend into `ecommerce-backend/dist` with its test settings, so run `npm run build` again before starting the backend on its own.

GitHub Actions runs the checks on every push, runs the API tests a second time on Postgres, as production uses it, and runs the end-to-end tests as a separate job that uploads a report when they fail.

## Security

- helmet sets security headers, including a content security policy that only allows the store's own scripts and connections to the API and Supabase
- Rate limits per IP address: 1000 API requests per 15 minutes, and lower limits for checking coupon codes, placing and cancelling orders, writing reviews and checking login tokens. Every request that sends a coupon code shares one limit, so codes can't be guessed through another route. Logging in itself goes to Supabase, which limits it
- JSON bodies are limited to 10 kB
- Every `/api/admin` path checks for an admin's verified token before any route runs, and who is an admin is only decided from the token
- In production, CORS allows no other origins unless `CORS_ORIGIN` lists them
- Reviews and orders save a masked name instead of the customer's email

## Deployment

[render.yaml](render.yaml) describes the Render service: it builds the frontend, installs the backend and starts it. Set the variables marked `sync: false` in the Render dashboard, and redeploy after changing a `VITE_` one, as they're read by the build.

### Database

Locally, the backend keeps its data in a SQLite file, so there's nothing to set up. In production it uses Postgres on Supabase, because the free Render server has no persistent disk.

For Supabase, copy the Session pooler URL from **Connect** in the project dashboard (the direct connection is IPv6 only), fill in the database password and set it as `DATABASE_URL`. The server connects over SSL, creates the tables and adds any new columns on startup, and adds the demo data only to empty tables, so data survives restarts and deploys. When the status column is first added, older orders whose packages have all arrived start as delivered, and the rest as processing.

Supabase pauses free projects after a week without activity, so a [GitHub Actions workflow](.github/workflows/keep-alive.yml) loads the products from the live API every 3 days.

### Accounts

1. In **Authentication > Sign In / Providers**, enable the Email provider.
2. In **Authentication > URL Configuration**, set the **Site URL** to the store's URL and add it, plus `http://localhost:5173`, to the **Redirect URLs**, with `/reset-password` on each or a wildcard like `https://<your-store>/**`.
3. In **Project Settings > JWT Keys**, make sure the project signs tokens with an asymmetric key (the default for new projects). The API checks tokens against the public keys, so it needs no secret.
4. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_URL`.

To make an account an admin, sign up in the store, copy the user's **User UID** from **Authentication > Users**, add it to `ADMIN_USER_IDS` and restart the backend.

Supabase's built-in email service only sends to the project's team and a few emails an hour. For real customers, set up SMTP in **Authentication > Emails > SMTP Settings**.

### Card Payment

In the Stripe Dashboard in test mode, copy the secret key from **Developers > API keys** into `STRIPE_SECRET_KEY`. For the deployed store, add a webhook endpoint at `https://<your-store>/api/stripe/webhook` for the event `checkout.session.completed` and copy its signing secret into `STRIPE_WEBHOOK_SECRET`. Locally the webhook is optional, as the page Stripe returns to confirms the payment too. Only a test key turns card payment on.

The Stripe sandbox is shared with another app, so every session is tagged with `app: "react-ecommerce"` and the webhook ignores events without the tag.

## Project Structure

```text
.
├── .github/workflows/    # CI (checks and end-to-end tests) and the database keep-alive
├── docs/screenshots/     # README images
├── e2e/                  # Playwright tests and the server they run against
├── ecommerce-backend/    # Express API
│   ├── defaultData/      # Demo products, delivery options and coupons
│   ├── middleware/       # Visitor ID, login tokens, admin check, coupons and rate limits
│   ├── models/           # Sequelize models
│   ├── routes/           # API routes
│   ├── test/             # API tests
│   ├── utils/            # Stock, order status, demo restock and other helpers
│   ├── documentation.md  # API reference
│   └── server.js         # Server entry point
├── public/               # Favicon, link preview image and product photos
├── src/
│   ├── components/       # Shared components
│   ├── hooks/            # Shared hooks
│   ├── i18n/             # English and German messages, and formatting for each language
│   ├── pages/            # Home, product, checkout, orders, tracking, login, account, wishlist and admin pages
│   ├── types/            # Shared TypeScript types
│   └── utils/            # Helpers and their tests
└── render.yaml           # Render deployment config
```

## Background

This project started from a React course. The backend is based on the [SuperSimpleDev course starter code](https://github.com/SuperSimpleDev/ecommerce-project), and I built the frontend while following the course, then migrated it to TypeScript. Since then I've extended it with a separate cart and orders per visitor, accounts with Supabase Auth, product pages with reviews, categories and filters, stock, coupons, card payment with Stripe, order statuses with an admin orders dashboard and overview, a wishlist, related and recently viewed products, German, a dark mode, a security pass, accessibility work, unit, API and end-to-end tests, CI and deployment config.

Product photos are from Unsplash and Pexels and credited in [CREDITS.md](public/images/products/CREDITS.md).
