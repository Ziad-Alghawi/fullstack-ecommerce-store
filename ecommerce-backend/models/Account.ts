import { DataTypes, type CreationOptional, type InferAttributes, type InferCreationAttributes, type Model } from 'sequelize';
import { sequelize } from './index.ts';

export interface AccountModel extends Model<InferAttributes<AccountModel>, InferCreationAttributes<AccountModel>> {
  id: string;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

// Users who have logged in. Their carts and orders share the visitorId column with
// guests', so this is how a restarted server tells them apart
export const Account = sequelize.define<AccountModel>('Account', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true
  },
  createdAt: {
    type: DataTypes.DATE(3)
  },
  updatedAt: {
    type: DataTypes.DATE(3)
  },
});
