import { DataTypes, type CreationOptional, type InferAttributes, type InferCreationAttributes, type Model } from 'sequelize';
import { sequelize } from './index.ts';

export interface ReviewModel extends Model<InferAttributes<ReviewModel>, InferCreationAttributes<ReviewModel>> {
  id: CreationOptional<string>;
  productId: string;
  userId: string;
  authorName: string;
  stars: number;
  text: CreationOptional<string | null>;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

export const MAX_REVIEW_TEXT_LENGTH = 500;

export const Review = sequelize.define<ReviewModel>('Review', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  productId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Products',
      key: 'id'
    }
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  // Shown in place of the email, which stays private
  authorName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  stars: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  text: {
    type: DataTypes.STRING(MAX_REVIEW_TEXT_LENGTH)
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
  // One review per user per product
  indexes: [{ unique: true, fields: ['productId', 'userId'] }]
});
