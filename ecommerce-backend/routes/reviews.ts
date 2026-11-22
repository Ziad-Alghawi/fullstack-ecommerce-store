import express, { type Request } from 'express';
import { Op } from 'sequelize';
import { asyncHandler } from '../middleware/asyncHandler.ts';
import { getSignedInUser, getUserId, requireUser } from '../middleware/auth.ts';
import { isAdmin } from '../middleware/admin.ts';
import { Order } from '../models/Order.ts';
import { Product, type ProductModel } from '../models/Product.ts';
import { MAX_REVIEW_TEXT_LENGTH, Review, type ReviewModel } from '../models/Review.ts';
import { isUuid } from '../utils/isUuid.ts';
import { reviewLimit } from '../middleware/rateLimits.ts';
import { maskEmail } from '../utils/maskEmail.ts';
import { refusal } from '../utils/refusal.ts';

// Mounted under /api/products/:productId, so it needs the parent's productId
const router = express.Router({ mergeParams: true });

// Deleted products keep their reviews, like they stay in old orders
router.use(asyncHandler(async (req, res, next) => {
  const { productId } = req.params;
  req.product = isUuid(productId) ? await Product.findByPk(productId, { paranoid: false }) : null;
  if (!req.product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  next();
}));

router.param('reviewId', asyncHandler(async (req, res, next) => {
  const { reviewId } = req.params;
  req.review = isUuid(reviewId) ? await Review.findOne({ where: { id: reviewId, productId: getProduct(req).id } }) : null;
  if (!req.review) {
    return res.status(404).json({ error: 'Review not found' });
  }
  next();
}));

// The middleware above sets these before any route of this router runs
function getProduct(req: Request): ProductModel {
  if (!req.product) {
    throw new Error('The reviews router has no product.');
  }
  return req.product;
}

function getReview(req: Request): ReviewModel {
  if (!req.review) {
    throw new Error('The reviews router has no review.');
  }
  return req.review;
}

// Never includes the author's user ID, only whether it's the user asking
function toResponse(review: ReviewModel, userId: string | null) {
  const { userId: authorId, ...fields } = review.toJSON();
  return { ...fields, isMine: authorId === userId };
}

// Logged in users keep their orders, so this is every order the user has placed. A cancelled one doesn't count
async function hasOrdered(userId: string, productId: string) {
  const orders = await Order.unscoped().findAll({
    where: { visitorId: userId, status: { [Op.ne]: 'cancelled' } },
    attributes: ['products']
  });
  return orders.some((order) => order.products.some((orderProduct) => orderProduct.productId === productId));
}

// Reviews add to the rating the product started with. Stars are rounded to the nearest half,
// the steps the rating images come in
async function updateRating(product: ProductModel) {
  product.demoRating ??= product.rating;
  const reviews = await Review.findAll({ where: { productId: product.id }, attributes: ['stars'] });

  const { stars: demoStars, count: demoCount } = product.demoRating;
  const count = demoCount + reviews.length;
  const totalStars = demoStars * demoCount + reviews.reduce((sum, review) => sum + review.stars, 0);

  product.rating = { stars: count ? Math.round((totalStars / count) * 2) / 2 : 0, count };
  await product.save();
}

// The fields a user can set, or the reason they're refused
type ReadReviewFields = { fields: { stars: number; text: string | null }; error?: never } | { error: string; fields?: never };

// What the user sends is unknown until it's checked
function readReviewFields({ stars, text = null }: Record<string, unknown>): ReadReviewFields {
  if (typeof stars !== 'number' || !Number.isInteger(stars) || stars < 1 || stars > 5) {
    return { error: 'Stars must be a whole number from 1 to 5' };
  }

  const trimmedText = typeof text === 'string' ? text.trim() : null;
  if ((text !== null && trimmedText === null) || (trimmedText !== null && trimmedText.length > MAX_REVIEW_TEXT_LENGTH)) {
    return { error: `The review text can be up to ${MAX_REVIEW_TEXT_LENGTH} characters` };
  }

  return { fields: { stars, text: trimmedText || null } };
}

router.get('/', asyncHandler(async (req, res) => {
  const userId = await getUserId(req);
  const product = getProduct(req);
  const reviews = await Review.findAll({ where: { productId: product.id } });

  res.json({
    reviews: reviews.map((review) => toResponse(review, userId)),
    canReview: userId !== null && await hasOrdered(userId, product.id)
  });
}));

router.post('/', reviewLimit, requireUser, asyncHandler(async (req, res) => {
  const user = getSignedInUser(req);
  const product = getProduct(req);

  if (!await hasOrdered(user.id, product.id)) {
    return res.status(403).json(refusal('reviewNotAllowed', 'Only customers who ordered this product can review it.'));
  }

  if (await Review.findOne({ where: { productId: product.id, userId: user.id } })) {
    return res.status(409).json(refusal('alreadyReviewed', "You've already reviewed this product. Edit your review instead."));
  }

  const { error, fields } = readReviewFields(req.body);
  if (!fields) {
    return res.status(400).json({ error });
  }

  const review = await Review.create({
    ...fields,
    productId: product.id,
    userId: user.id,
    authorName: maskEmail(user.email)
  });
  await updateRating(product);
  res.status(201).json(toResponse(review, user.id));
}));

router.put('/:reviewId', reviewLimit, requireUser, asyncHandler(async (req, res) => {
  const review = getReview(req);
  const user = getSignedInUser(req);
  if (review.userId !== user.id) {
    return res.status(403).json({ error: 'You can only edit your own review.' });
  }

  const { error, fields } = readReviewFields(req.body);
  if (!fields) {
    return res.status(400).json({ error });
  }

  await review.update(fields);
  await updateRating(getProduct(req));
  res.json(toResponse(review, user.id));
}));

router.delete('/:reviewId', reviewLimit, requireUser, asyncHandler(async (req, res) => {
  const review = getReview(req);
  const user = getSignedInUser(req);
  if (review.userId !== user.id && !isAdmin(user.id)) {
    return res.status(403).json({ error: 'You can only delete your own review.' });
  }

  await review.destroy();
  await updateRating(getProduct(req));
  res.status(204).send();
}));

export default router;
