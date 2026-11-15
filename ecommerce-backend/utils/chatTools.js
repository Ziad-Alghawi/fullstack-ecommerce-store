import { Op } from 'sequelize';
import { PRODUCT_CATEGORIES, Product } from '../models/Product.js';
import { isUuid } from './isUuid.js';
import { matchesSearch } from './productSearch.js';

const MAX_RESULTS = 4;

export const chatTools = [
  {
    name: 'search_products',
    description: "Searches the store's products. Every filter is optional. Returns up to 4 matching products, best rated first. "
      + "Words in the query must all appear in a product's name or keywords, so use one or two plain words like \"socks\".",
    parametersJsonSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words from the product name or keywords, in English' },
        category: { type: 'string', enum: PRODUCT_CATEGORIES },
        max_price_eur: { type: 'number', description: 'The most the product may cost, in euros' },
        in_stock_only: { type: 'boolean', description: 'Only products that can be ordered now' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'get_product_details',
    description: 'Gets one product by the id that search_products returned.',
    parametersJsonSchema: {
      type: 'object',
      properties: { product_id: { type: 'string' } },
      required: ['product_id'],
      additionalProperties: false
    }
  }
];

// What the model sees of a product. Prices are in euros, as shoppers read them
function describeProduct(product) {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    price_eur: (product.priceCents / 100).toFixed(2),
    stock: product.stock,
    rating_stars: product.rating.stars,
    rating_count: product.rating.count,
    keywords: product.keywords
  };
}

async function searchProducts({ query, category, max_price_eur: maxPriceEur, in_stock_only: inStockOnly }) {
  const where = {};
  if (typeof category === 'string' && PRODUCT_CATEGORIES.includes(category)) {
    where.category = category;
  }
  if (typeof maxPriceEur === 'number' && Number.isFinite(maxPriceEur)) {
    where.priceCents = { [Op.lte]: Math.round(maxPriceEur * 100) };
  }
  if (inStockOnly === true) {
    where.stock = { [Op.gt]: 0 };
  }

  const words = typeof query === 'string' ? query.slice(0, 100).split(/\s+/).filter(Boolean) : [];
  return (await Product.findAll({ where }))
    .filter((product) => words.every((word) => matchesSearch(product, word)))
    .sort((a, b) => b.rating.stars - a.rating.stars || b.rating.count - a.rating.count)
    .slice(0, MAX_RESULTS);
}

async function getProductDetails({ product_id: productId }) {
  const product = isUuid(productId) ? await Product.findByPk(productId) : null;
  return product ? [product] : [];
}

const tools = { search_products: searchProducts, get_product_details: getProductDetails };

// Runs a tool the model asked for, always read-only. The products are for showing as cards, and
// the output is what the model reads back. What the model sends is checked here, not trusted
export async function runChatTool(name, input) {
  if (!Object.hasOwn(tools, name)) {
    return { output: 'Unknown tool', isError: true, products: [] };
  }
  const products = await tools[name](input && typeof input === 'object' ? input : {});
  return {
    output: products.length ? products.map(describeProduct) : 'No products found',
    isError: false,
    products
  };
}
