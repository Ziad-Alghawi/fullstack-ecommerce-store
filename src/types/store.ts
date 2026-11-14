export interface Rating {
  stars: number;
  count: number;
}

export interface Product {
  id: string;
  image: string;
  name: string;
  rating: Rating;
  priceCents: number;
  keywords?: string[];
  // Null for a product added before categories, until an admin sets one
  category?: string | null;
  // How many can still be ordered
  stock: number;
  // Set when an admin deleted it. The shop no longer lists it, but old orders still show it
  deletedAt?: string | null;
}

export interface Review {
  id: string;
  productId: string;
  // The first 2 characters of the reviewer's email followed by "***", or "Customer"
  authorName: string;
  stars: number;
  text: string | null;
  createdAt: string;
  updatedAt: string;
  isMine: boolean;
}

export interface ProductReviews {
  // Newest first
  reviews: Review[];
  // Whether the user has ordered the product, which reviewing needs
  canReview: boolean;
}

export interface CartItem {
  productId: string;
  quantity: number;
  deliveryOptionId: string;
  product: Product;
}

export interface DeliveryOption {
  id: string;
  deliveryDays?: number;
  priceCents: number;
  estimatedDeliveryTimeMs: number;
}

export interface AppliedCoupon {
  code: string;
  percentOff: number;
}

export interface Coupon extends AppliedCoupon {
  id: string;
  // Null for a coupon that never expires
  expiresAt: string | null;
  active: boolean;
  // Suggested at checkout, if it's the newest featured coupon that can be used
  featured: boolean;
}

export interface PaymentSummary {
  totalItems: number;
  productCostCents: number;
  coupon: AppliedCoupon | null;
  // Taken off the items, before tax
  discountCents: number;
  shippingCostCents: number;
  totalCostBeforeTaxCents: number;
  taxCents: number;
  totalCostCents: number;
}

export interface OrderProduct {
  id?: string;
  productId: string;
  quantity: number;
  estimatedDeliveryTimeMs: number;
  product: Product;
}

export type OrderStatus = 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface Order {
  id: string;
  orderTimeMs: number;
  totalCostCents: number;
  products: OrderProduct[];
  paymentMethod: 'card' | 'delivery';
  status: OrderStatus;
}

export interface AdminOrder {
  id: string;
  orderTimeMs: number;
  // The customer's masked email, "Customer" without one, or "Guest"
  customerName: string;
  items: { name: string; quantity: number }[];
  totalCostCents: number;
  paymentMethod: Order['paymentMethod'];
  status: OrderStatus;
  // Where an admin can move the order now
  nextStatuses: OrderStatus[];
}

export interface AdminOrderList {
  // The newest orders that match the filters
  orders: AdminOrder[];
  // How many orders match, including those not listed
  total: number;
}

export interface AdminStats {
  ordersLastDay: number;
  ordersLastWeek: number;
  // Without cancelled orders
  revenueLastWeekCents: number;
  // At or below 5 in stock, fewest first
  lowStockProducts: Pick<Product, 'id' | 'name' | 'stock'>[];
  // The 5 that sold the most units, most first
  topProducts: (Pick<Product, 'id' | 'name' | 'image'> & { unitsSold: number })[];
}

// The values a refusal's message is made from, so the store can say it in the visitor's language
export interface ApiErrorParams {
  product?: string;
  stock?: number;
  inCart?: number;
  code?: string;
  max?: number;
  status?: OrderStatus;
  nextStatus?: OrderStatus;
}

// What the API answers a request it refuses with
export interface ApiError {
  error?: string;
  code?: string;
  params?: ApiErrorParams;
}

export type LoadCart = () => Promise<void>;
export type CartStatus = 'loading' | 'ready' | 'failed';
