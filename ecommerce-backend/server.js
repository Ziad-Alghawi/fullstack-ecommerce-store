// Must come first: the modules below read their settings as soon as they load
import './loadEnv.js';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { sequelize } from './models/index.js';
import productRoutes from './routes/products.js';
import reviewRoutes from './routes/reviews.js';
import deliveryOptionRoutes from './routes/deliveryOptions.js';
import cartItemRoutes from './routes/cartItems.js';
import orderRoutes from './routes/orders.js';
import resetRoutes from './routes/reset.js';
import paymentSummaryRoutes from './routes/paymentSummary.js';
import adminRoutes from './routes/admin.js';
import adminCouponRoutes from './routes/adminCoupons.js';
import adminOrderRoutes from './routes/adminOrders.js';
import adminStatsRoutes from './routes/adminStats.js';
import couponRoutes, { getFeaturedCoupon } from './routes/coupons.js';
import meRoutes from './routes/me.js';
import wishlistRoutes from './routes/wishlist.js';
import stripeRoutes, { handleWebhook } from './routes/stripe.js';
import { corsOrigins } from './utils/corsOrigins.js';
import { publicSiteUrl } from './utils/publicSiteUrl.js';
import { renderIndexHtml } from './utils/indexHtml.js';
import { redirectToPublicSite } from './middleware/redirectToPublicSite.js';
import { loadVisitors, requireVisitor } from './middleware/visitor.js';
import { requireAdmin } from './middleware/admin.js';
import { apiLimit } from './middleware/rateLimits.js';
import { CartItem } from './models/CartItem.js';
import { Order } from './models/Order.js';
import { Product } from './models/Product.js';
import { Coupon } from './models/Coupon.js';
import { addDefaultData } from './defaultData/addDefaultData.js';
import { restockIfDue } from './utils/demoRestock.js';
import { markArrivedOrdersDelivered } from './utils/orderStatus.js';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Render runs the app behind one proxy, which gives the client's IP address that rate limits count by
app.set('trust proxy', 1);

app.use(redirectToPublicSite);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      // Logging in talks to Supabase from the browser. Stripe Checkout is a page of its own, so it needs nothing here
      connectSrc: ["'self'", ...(process.env.SUPABASE_URL ? [new URL(process.env.SUPABASE_URL).origin] : [])]
    }
  }
}));
app.use(compression());
app.use(cors({ origin: corsOrigins }));
// Before the rate limit, as Stripe sends every event from its own servers
app.post('/api/stripe/webhook', express.raw({ type: 'application/json', limit: '256kb' }), handleWebhook);
app.use('/api', apiLimit);
// The largest request, a product or a review, is well under 10 kB
app.use(express.json({ limit: '10kb' }));

app.use('/api/products', productRoutes);
app.use('/api/products/:productId/reviews', reviewRoutes);
app.use('/api/delivery-options', deliveryOptionRoutes);
// Each visitor has their own cart and orders. Products are shared
app.use('/api/cart-items', requireVisitor, cartItemRoutes);
app.use('/api/orders', requireVisitor, orderRoutes);
app.use('/api/reset', resetRoutes);
app.use('/api/payment-summary', requireVisitor, paymentSummaryRoutes);
app.use('/api/coupons', couponRoutes);
app.get('/api/featured-coupon', getFeaturedCoupon);
app.use('/api/me', meRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/stripe', stripeRoutes);
// Checked once for every admin path, so an admin route can't be added without it
app.use('/api/admin', requireAdmin);
app.use('/api/admin/coupons', adminCouponRoutes);
app.use('/api/admin/orders', adminOrderRoutes);
app.use('/api/admin/stats', adminStatsRoutes);
app.use('/api/admin', adminRoutes);

// An unknown API path is an error, not a page for React Router
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// The built frontend, including the product images from its public folder. The home page is
// served below like the other pages, as it gets the store's address filled in
app.use(express.static(path.join(__dirname, 'dist'), { index: false }));

// Let React Router handle every other path
const indexPath = path.join(__dirname, 'dist', 'index.html');
let indexHtml;
app.get('*', (req, res) => {
  if (!indexHtml && fs.existsSync(indexPath)) {
    indexHtml = fs.readFileSync(indexPath, 'utf8');
  }
  if (!indexHtml) {
    return res.status(404).send('index.html not found');
  }
  res.type('html').send(renderIndexHtml(indexHtml, publicSiteUrl, req.path));
});

// Express only treats a handler with four arguments as an error handler, so next has to stay
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Errors like a malformed JSON body come with their own 4xx status and a message safe to show
  const status = err.status || 500;
  if (status >= 500) {
    console.error(err.stack);
    return res.status(status).json({ error: 'Something went wrong!' });
  }
  res.status(status).json({ error: err.message });
});

// Older databases have one cart and order list shared by everyone, which can't
// be split between visitors. Drop those two tables so sync() makes them again
for (const model of [CartItem, Order]) {
  // Fails when the table doesn't exist yet, which is fine
  const columns = await sequelize.getQueryInterface()
    .describeTable(model.getTableName())
    .catch(() => null);
  if (columns && !columns.visitorId) {
    await model.drop();
    console.log(`Dropped the old shared ${model.getTableName()} table.`);
  }
}

// sync() creates missing tables and indexes but doesn't change existing tables, so
// add the columns that came later first, as their indexes need them
const laterColumns = [
  [Product, ['deletedAt', 'demoRating', 'category', 'stock']],
  [Order, ['paymentMethod', 'stripeSessionId', 'status', 'customerName']],
  [Coupon, ['featured']]
];
for (const [model, columns] of laterColumns) {
  const existingColumns = await sequelize.getQueryInterface()
    .describeTable(model.getTableName())
    .catch(() => null);
  for (const column of columns.filter((column) => existingColumns && !existingColumns[column])) {
    await sequelize.getQueryInterface().addColumn(model.getTableName(), column, model.getAttributes()[column]);
    console.log(`Added ${column} to the ${model.getTableName()} table.`);
    if (model === Order && column === 'status') {
      await markArrivedOrdersDelivered();
    }
  }
}

await sequelize.sync();

await addDefaultData();
await restockIfDue();
await loadVisitors();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
