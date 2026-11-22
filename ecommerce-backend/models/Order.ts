import { DataTypes, type CreationOptional, type InferAttributes, type InferCreationAttributes, type Model } from 'sequelize';
import { sequelize } from './index.ts';

// Processing, then shipped, then delivered. Only an order that hasn't shipped can be cancelled
export const ORDER_STATUSES = ['processing', 'shipped', 'delivered', 'cancelled'] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];

export type PaymentMethod = 'delivery' | 'card';

// What an order keeps of each item. Deliveries are worked out when the order is placed
export interface OrderProduct {
  productId: string;
  quantity: number;
  estimatedDeliveryTimeMs: number;
}

export interface OrderModel extends Model<InferAttributes<OrderModel>, InferCreationAttributes<OrderModel>> {
  id: CreationOptional<string>;
  visitorId: string;
  orderTimeMs: number;
  totalCostCents: number;
  products: OrderProduct[];
  paymentMethod: PaymentMethod;
  customerName: CreationOptional<string | null>;
  status: OrderStatus;
  stripeSessionId: CreationOptional<string | null>;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

export const Order = sequelize.define<OrderModel>('Order', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  visitorId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  orderTimeMs: {
    type: DataTypes.BIGINT,
    allowNull: false,
    // Postgres returns BIGINT as a string. Millisecond timestamps fit safely in a JS number
    get() {
      return Number(this.getDataValue('orderTimeMs'));
    }
  },
  totalCostCents: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  products: {
    type: DataTypes.JSON,
    allowNull: false
  },
  // 'delivery' or 'card'
  paymentMethod: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'delivery'
  },
  // The customer's masked email, like reviews show it. Null for a guest
  customerName: {
    type: DataTypes.STRING
  },
  // One of ORDER_STATUSES. Admins move it forward, and customers can cancel an order that hasn't shipped
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'processing'
  },
  // The Stripe Checkout Session that paid for a card order. Unique, so one payment makes one order
  stripeSessionId: {
    type: DataTypes.STRING
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
  indexes: [{ fields: ['visitorId'] }, { unique: true, fields: ['stripeSessionId'] }]
});
