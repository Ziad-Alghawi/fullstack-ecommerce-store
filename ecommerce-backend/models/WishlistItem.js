import { DataTypes } from 'sequelize';
import { sequelize } from './index.js';

// A product a logged in user saved for later
export const WishlistItem = sequelize.define('WishlistItem', {
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
