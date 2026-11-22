import express from 'express';
import { asyncHandler } from '../middleware/asyncHandler.ts';
import { PRODUCT_CATEGORIES, Product, isProductCategory, type ProductCategory } from '../models/Product.ts';
import { rejectInvalidId } from '../utils/isUuid.ts';

const router = express.Router();

const MAX_NAME_LENGTH = 100;
const MAX_PRICE_CENTS = 1000000;
const MAX_STOCK = 100000;
// Keywords are saved comma-separated in a 255 character column
const MAX_KEYWORDS = 10;
const MAX_KEYWORD_LENGTH = 20;

router.param('productId', rejectInvalidId('Product not found'));

// New products reuse the store's photos, including those of hidden products
async function getProductImages() {
  const products = await Product.findAll({ attributes: ['image'], paranoid: false });
  return [...new Set(products.map(({ image }) => image))].sort();
}

// The trimmed keywords, or null if any of them can't be saved
function readKeywords(keywords: unknown) {
  if (!Array.isArray(keywords) || keywords.length > MAX_KEYWORDS) {
    return null;
  }
  const trimmed = keywords.map((keyword) => (typeof keyword === 'string' ? keyword.trim() : ''));
  const isValid = (keyword: string) => keyword && keyword.length <= MAX_KEYWORD_LENGTH && !keyword.includes(',');
  return trimmed.every(isValid) ? trimmed : null;
}

// The fields an admin can set, or the reason they're refused. The rating is never set here
interface ProductFields {
  name: string;
  priceCents: number;
  image: string;
  keywords: string[];
  category: ProductCategory;
  stock: number;
}

type ReadProductFields = { fields: ProductFields; error?: never } | { error: string; fields?: never };

// What the admin sends is unknown until it's checked
async function readProductFields({ name, priceCents, image, keywords, category, stock }: Record<string, unknown>): Promise<ReadProductFields> {
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName || trimmedName.length > MAX_NAME_LENGTH) {
    return { error: `Name is required and can be up to ${MAX_NAME_LENGTH} characters` };
  }

  if (typeof priceCents !== 'number' || !Number.isInteger(priceCents) || priceCents < 1 || priceCents > MAX_PRICE_CENTS) {
    return { error: `Price must be a whole number of cents from 1 to ${MAX_PRICE_CENTS}` };
  }

  const trimmedKeywords = readKeywords(keywords);
  if (!trimmedKeywords) {
    return {
      error: `Keywords must be a list of up to ${MAX_KEYWORDS} words without commas, each up to ${MAX_KEYWORD_LENGTH} characters`
    };
  }

  if (typeof stock !== 'number' || !Number.isInteger(stock) || stock < 0 || stock > MAX_STOCK) {
    return { error: `Stock must be a whole number from 0 to ${MAX_STOCK}` };
  }

  if (!isProductCategory(category)) {
    return { error: `Category must be one of: ${PRODUCT_CATEGORIES.join(', ')}` };
  }

  if (typeof image !== 'string' || !(await getProductImages()).includes(image)) {
    return { error: 'Image must be one of the product images' };
  }

  return { fields: { name: trimmedName, priceCents, image, keywords: trimmedKeywords, category, stock } };
}

router.get('/images', asyncHandler(async (req, res) => {
  res.json(await getProductImages());
}));

router.post('/products', asyncHandler(async (req, res) => {
  const { error, fields } = await readProductFields(req.body);
  if (!fields) {
    return res.status(400).json({ error });
  }

  const product = await Product.create({ ...fields, rating: { stars: 0, count: 0 } });
  res.status(201).json(product);
}));

router.put('/products/:productId', asyncHandler(async (req, res) => {
  const product = await Product.findByPk(req.params.productId);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const { error, fields } = await readProductFields(req.body);
  if (!fields) {
    return res.status(400).json({ error });
  }

  res.json(await product.update(fields));
}));

router.delete('/products/:productId', asyncHandler(async (req, res) => {
  const product = await Product.findByPk(req.params.productId);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  await product.destroy();
  res.status(204).send();
}));

export default router;
