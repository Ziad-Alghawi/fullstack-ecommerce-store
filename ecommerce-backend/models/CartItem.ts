import { DataTypes, type CreationOptional, type InferAttributes, type InferCreationAttributes, type Model } from 'sequelize';
import { sequelize } from './index.ts';

export interface CartItemModel extends Model<InferAttributes<CartItemModel>, InferCreationAttributes<CartItemModel>> {
  visitorId: string;
  productId: string;
  quantity: number;
  deliveryOptionId: string;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

export const CartItem = sequelize.define<CartItemModel>('CartItem', {
  visitorId: {
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
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  deliveryOptionId: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: 'DeliveryOptions',
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
    order: [['createdAt', 'ASC']]
  },
  indexes: [{ fields: ['visitorId'] }]
});
