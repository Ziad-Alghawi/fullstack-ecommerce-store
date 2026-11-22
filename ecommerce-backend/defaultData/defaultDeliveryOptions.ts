import type { CreationAttributes } from 'sequelize';
import type { DeliveryOptionModel } from '../models/DeliveryOption.ts';

export const defaultDeliveryOptions: CreationAttributes<DeliveryOptionModel>[] = [
  {
    id: "1",
    deliveryDays: 7,
    priceCents: 0
  },
  {
    id: "2",
    deliveryDays: 3,
    priceCents: 499
  },
  {
    id: "3",
    deliveryDays: 1,
    priceCents: 999
  }
];
