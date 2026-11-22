import { Op, type CreationAttributes, type Model, type ModelStatic } from 'sequelize';
import { Product } from '../models/Product.ts';
import { DeliveryOption } from '../models/DeliveryOption.ts';
import { Coupon } from '../models/Coupon.ts';
import { defaultProducts } from './defaultProducts.ts';
import { defaultDeliveryOptions } from './defaultDeliveryOptions.ts';
import { defaultCoupons } from './defaultCoupons.ts';

// The models are sorted by createdAt, so each row gets its own timestamp to keep the list order
function withTimestamps<T extends object>(rows: T[], timestamp: number) {
  return rows.map((row, index) => ({
    ...row,
    createdAt: new Date(timestamp + index),
    updatedAt: new Date(timestamp + index)
  }));
}

// A database from before a product column was added has it empty, so the demo products get
// theirs from the demo data. Products an admin added have no category and no stock until an admin sets them
async function fillNewProductColumns() {
  const products = await Product.findAll({
    where: { [Op.or]: [{ category: null }, { stock: null }] },
    paranoid: false
  });
  for (const product of products) {
    const defaults = defaultProducts.find(({ id }) => id === product.id);
    await product.update({
      category: product.category ?? defaults?.category ?? null,
      stock: product.stock ?? defaults?.stock ?? 0
    });
  }
}

async function fillIfEmpty<M extends Model>(model: ModelStatic<M>, rows: CreationAttributes<M>[], timestamp: number) {
  // Hidden products still take up their IDs
  if (await model.count({ paranoid: false }) === 0) {
    await model.bulkCreate(withTimestamps(rows, timestamp));
    console.log(`Added the default ${model.getTableName()}.`);
  }
}

// Only fills empty tables, so a persistent database keeps its rows across restarts and deploys
export async function addDefaultData() {
  const timestamp = Date.now();
  await fillIfEmpty(Product, defaultProducts, timestamp);
  await fillIfEmpty(DeliveryOption, defaultDeliveryOptions, timestamp);
  await fillIfEmpty(Coupon, defaultCoupons, timestamp);

  await fillNewProductColumns();
}
