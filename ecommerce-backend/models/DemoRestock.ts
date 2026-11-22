import { DataTypes, type CreationOptional, type InferAttributes, type InferCreationAttributes, type Model } from 'sequelize';
import { sequelize } from './index.ts';

export interface DemoRestockModel extends Model<InferAttributes<DemoRestockModel>, InferCreationAttributes<DemoRestockModel>> {
  id: number;
  lastRunAt: Date;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

// A single row with when the demo products were last restocked. It's in the database, so a
// server that sleeps and restarts often still restocks only once a day
export const DemoRestock = sequelize.define<DemoRestockModel>('DemoRestock', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  lastRunAt: {
    type: DataTypes.DATE(3),
    allowNull: false
  },
  createdAt: {
    type: DataTypes.DATE(3)
  },
  updatedAt: {
    type: DataTypes.DATE(3)
  },
});
