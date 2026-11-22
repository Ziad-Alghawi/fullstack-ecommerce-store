import { DataTypes, type CreationOptional, type InferAttributes, type InferCreationAttributes, type Model } from 'sequelize';
import { sequelize } from './index.ts';

export const PRODUCT_CATEGORIES = ['Home & Kitchen', 'Clothing', 'Shoes', 'Accessories', 'Sports'] as const;
export type ProductCategory = typeof PRODUCT_CATEGORIES[number];

export function isProductCategory(value: unknown): value is ProductCategory {
  return (PRODUCT_CATEGORIES as readonly unknown[]).includes(value);
}

export interface Rating {
  stars: number;
  count: number;
}

export interface ProductModel extends Model<InferAttributes<ProductModel>, InferCreationAttributes<ProductModel>> {
  id: CreationOptional<string>;
  image: string;
  name: string;
  rating: Rating;
  demoRating: CreationOptional<Rating | null>;
  priceCents: number;
  keywords: string[];
  category: CreationOptional<ProductCategory | null>;
  stock: CreationOptional<number | null>;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
  deletedAt: CreationOptional<Date | null>;
}

export const Product = sequelize.define<ProductModel>('Product', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  image: {
    type: DataTypes.STRING,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  rating: {
    type: DataTypes.JSON,
    allowNull: false
  },
  // The rating from the demo data, which reviews are added to. Saved when the first review changes the rating
  demoRating: {
    type: DataTypes.JSON
  },
  priceCents: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  keywords: {
    type: DataTypes.STRING,
    allowNull: false,
    // Saved as one comma-separated string
    get() {
      const keywords = this.getDataValue('keywords') as unknown as string | null;
      return keywords ? keywords.split(',') : [];
    },
    set(val: string[]) {
      this.setDataValue('keywords', val.join(',') as unknown as string[]);
    }
  },
  // One of PRODUCT_CATEGORIES. Empty only in a database from before categories, until addDefaultData fills it
  category: {
    type: DataTypes.STRING
  },
  // How many can still be ordered. Empty only in a database from before stock, until addDefaultData fills it
  stock: {
    type: DataTypes.INTEGER
  },
  createdAt: {
    type: DataTypes.DATE(3)
  },
  updatedAt: {
    type: DataTypes.DATE(3)
  },
  deletedAt: {
    type: DataTypes.DATE(3)
  },
}, {
  // Deleting only hides a product, so the carts and orders that have it keep working.
  // Queries skip hidden products unless they pass paranoid: false
  paranoid: true,
  defaultScope: {
    order: [['createdAt', 'ASC']]
  }
});

// The demo rating is only for working out the rating, so responses leave it out
Product.prototype.toJSON = function (this: ProductModel) {
  const { demoRating, ...product } = this.get({ plain: true });
  return product;
};
