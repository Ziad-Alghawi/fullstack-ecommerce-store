import express from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireUser } from '../middleware/auth.js';
import { Product } from '../models/Product.js';
import { WishlistItem } from '../models/WishlistItem.js';
import { rejectInvalidId } from '../utils/isUuid.js';

const router = express.Router();

router.param('productId', rejectInvalidId('Product not found'));
router.use(requireUser);

// Newest first. A product an admin deleted stays on the list with deletedAt set, so the user sees it's gone
router.get('/', asyncHandler(async (req, res) => {
  const items = await WishlistItem.findAll({ where: { userId: req.user.id } });
  const products = await Product.findAll({ where: { id: items.map(({ productId }) => productId) }, paranoid: false });
  const productsById = new Map(products.map((product) => [product.id, product]));

  res.json(items.map(({ productId, createdAt }) => ({ productId, createdAt, product: productsById.get(productId) })));
}));

// Saving a product again changes nothing. Deleted products can't be saved
router.put('/:productId', asyncHandler(async (req, res) => {
  const product = await Product.findByPk(req.params.productId.toLowerCase());
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  await WishlistItem.bulkCreate([{ userId: req.user.id, productId: product.id }], { ignoreDuplicates: true });
  res.status(204).send();
}));

router.delete('/:productId', asyncHandler(async (req, res) => {
  await WishlistItem.destroy({ where: { userId: req.user.id, productId: req.params.productId.toLowerCase() } });
  res.status(204).send();
}));

export default router;
