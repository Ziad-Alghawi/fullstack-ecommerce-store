import express from 'express';
import { Op } from 'sequelize';
import { asyncHandler } from '../middleware/asyncHandler.ts';
import type { WhereAttributeHash } from 'sequelize';
import { PRODUCT_CATEGORIES, Product, type ProductCategory, type ProductModel } from '../models/Product.ts';
import { rejectInvalidId } from '../utils/isUuid.ts';
import { restockIfDue } from '../utils/demoRestock.ts';
import { matchesSearch } from '../utils/productSearch.ts';

const router = express.Router();

router.param('productId', rejectInvalidId('Product not found'));

router.use(asyncHandler(async (req, res, next) => {
  await restockIfDue();
  next();
}));

// Without a sort, products keep the store's own order. Ties in rating go to the most rated
type CompareProducts = (a: ProductModel, b: ProductModel) => number;

const SORTS: Record<string, CompareProducts> = {
  'price-asc': (a, b) => a.priceCents - b.priceCents,
  'price-desc': (a, b) => b.priceCents - a.priceCents,
  rating: (a, b) => b.rating.stars - a.rating.stars || b.rating.count - a.rating.count,
  newest: (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
};

// The filters as a database query, or the reason they're refused
type ReadFilters =
  | { where: WhereAttributeHash<ProductModel>; compare: CompareProducts | undefined; error?: never }
  | { error: string; where?: never; compare?: never };

function readFilters({ category = '', sort = '', minPriceCents = '', maxPriceCents = '' }: Record<string, unknown>): ReadFilters {
  // A repeated parameter arrives as a list
  if (typeof category !== 'string' || typeof sort !== 'string' || typeof minPriceCents !== 'string' || typeof maxPriceCents !== 'string') {
    return { error: 'Each filter can only be given once' };
  }
  if (sort && !Object.hasOwn(SORTS, sort)) {
    return { error: `Sort must be one of: ${Object.keys(SORTS).join(', ')}` };
  }
  if (![minPriceCents, maxPriceCents].every((price) => /^\d*$/.test(price))) {
    return { error: 'Prices must be whole numbers of cents' };
  }

  const where: WhereAttributeHash<ProductModel> = {};
  if (category) {
    // A category that doesn't exist simply matches nothing
    where.category = category as ProductCategory;
  }
  if (minPriceCents || maxPriceCents) {
    where.priceCents = {
      ...(minPriceCents ? { [Op.gte]: Number(minPriceCents) } : {}),
      ...(maxPriceCents ? { [Op.lte]: Number(maxPriceCents) } : {})
    };
  }
  return { where, compare: SORTS[sort] };
}

router.get('/', asyncHandler(async (req, res) => {
  const { error, where, compare } = readFilters(req.query);
  if (!where) {
    return res.status(400).json({ error });
  }

  let products = await Product.findAll({ where });

  const search = req.query.search;
  if (typeof search === 'string' && search) {
    products = products.filter((product) => matchesSearch(product, search));
  }

  res.json(compare ? products.sort(compare) : products);
}));

router.get('/categories', (req, res) => {
  res.json(PRODUCT_CATEGORIES);
});

// Deleted products too, so links from old orders still open, with deletedAt set
router.get('/:productId', asyncHandler(async (req, res) => {
  const product = await Product.findByPk(req.params.productId, { paranoid: false });
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(product);
}));

export default router;
