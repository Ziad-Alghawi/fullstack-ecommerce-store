import { DataTypes, type CreationOptional, type InferAttributes, type InferCreationAttributes, type Model } from 'sequelize';
import { sequelize } from './index.ts';

export interface DeliveryOptionModel extends Model<InferAttributes<DeliveryOptionModel>, InferCreationAttributes<DeliveryOptionModel>> {
  id: string;
  deliveryDays: number;
  priceCents: number;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

export const DeliveryOption = sequelize.define<DeliveryOptionModel>('DeliveryOption', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  deliveryDays: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  priceCents: {
    type: DataTypes.INTEGER,
    allowNull: false
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
  }
});

export function estimateDeliveryTimeMs(deliveryOption: Pick<DeliveryOptionModel, 'deliveryDays'>) {
  return Date.now() + deliveryOption.deliveryDays * 24 * 60 * 60 * 1000;
}
