import { DataTypes, type CreationOptional, type InferAttributes, type InferCreationAttributes, type Model } from 'sequelize';
import { sequelize } from './index.ts';

export interface WishlistItemModel extends Model<InferAttributes<WishlistItemModel>, InferCreationAttributes<WishlistItemModel>> {
  userId: string;
  productId: string;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

// A product a logged in user saved for later
export const WishlistItem = sequelize.define<WishlistItemModel>('WishlistItem', {
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  productId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Products',
      key: 'id'
    }
  },
  createdAt: {
    type: DataTypes.DATE(3)
  },
  updatedAt: {
    type: DataTypes.DATE(3)
  },
}, {
  defaultScope: {
    order: [['createdAt', 'DESC']]
  },
  // Each product once per user
  indexes: [{ unique: true, fields: ['userId', 'productId'] }]
});
