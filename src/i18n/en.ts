import type { ApiErrorParams, OrderStatus } from '../types/store';

const plural = (count: number, one: string, other: string) => `${count} ${count === 1 ? one : other}`;

export const en = {
  common: {
    tryAgain: 'Try again',
    browseProducts: 'Browse products',
    logIn: 'Log in',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    keep: 'Keep',
    saveChanges: 'Save changes',
    apply: 'Apply',
    remove: 'Remove',
    close: 'Close',
    addToCart: 'Add to Cart',
    email: 'Email',
    password: 'Password',
    quantity: 'Quantity:',
    noLongerAvailable: 'No longer available',
    viewAllOrders: 'View all orders'
  },
  app: {
    pageLoadFailed: 'Check your connection and try again.',
    changeNotSaved: "Your change wasn't saved. The demo server may be waking up, so please try again.",
    footerNote: 'Demo store, data resets regularly. No real orders or payments.',
    footerLink: 'View the code on GitHub'
  },
  pageStatus: {
    loading: 'Loading...',
    slow: 'The demo server is waking up. This can take up to a minute.',
    errorTitle: "We couldn't load this page",
    errorDetail: 'The demo server may be waking up. Please try again in a moment.'
  },
  header: {
    logo: (store: string) => `${store} home`,
    search: 'Search products',
    searchButton: 'Search',
    admin: 'Admin',
    orders: 'Orders',
    account: 'Account',
    accountLabel: (email: string | undefined) => `Your account, ${email}`,
    cart: 'Cart',
    cartLabel: (count: number) => `Cart, ${plural(count, 'item', 'items')}`,
    language: 'Language'
  },
  toasts: {
    notifications: 'Notifications',
    errors: 'Errors'
  },
  rating: {
    stars: (stars: string) => `${stars} out of 5 stars`
  },
  stock: {
    outOfStock: 'Out of stock',
    onlyLeft: (stock: number) => `Only ${stock} left`,
    inStock: (stock: string) => `${stock} in stock`
  },
  addToCart: {
    quantityLabel: (name: string) => `Quantity of ${name}`,
    added: (name: string, quantity: number) => `${quantity > 1 ? `${quantity} × ` : ''}${name} added to your cart`,
    viewCart: 'View cart'
  },
  categories: {
    'Home & Kitchen': 'Home & Kitchen',
    Clothing: 'Clothing',
    Shoes: 'Shoes',
    Accessories: 'Accessories',
    Sports: 'Sports'
  },
  home: {
    title: 'Everyday essentials, delivered',
    intro: 'Home, kitchen and wardrobe basics, with a free delivery option on every order.',
    resultsFor: (search: string) => `Results for "${search}"`,
    noResults: (search: string) => `No products found for "${search}"`,
    noMatch: 'No products match these filters',
    noProducts: 'No products available',
    categories: 'Categories',
    allCategories: 'All',
    productCount: (count: number) => plural(count, 'product', 'products'),
    clearFilters: 'Clear filters',
    price: 'Price',
    minPrice: 'Minimum price in dollars',
    maxPrice: 'Maximum price in dollars',
    min: 'Min',
    max: 'Max',
    priceTo: 'to',
    sortBy: 'Sort by',
    sorts: {
      '': 'Featured',
      'price-asc': 'Price: low to high',
      'price-desc': 'Price: high to low',
      rating: 'Customer rating',
      newest: 'Newest'
    }
  },
  product: {
    title: 'Product',
    notFound: "We couldn't find this product",
    related: 'You may also like',
    recentlyViewed: 'Recently viewed'
  },
  reviews: {
    title: 'Customer reviews',
    loadFailed: "We couldn't load the reviews",
    loading: 'Loading reviews...',
    orderedOnly: 'Only customers who ordered this product can review it.',
    logInLink: 'Log in',
    logInRest: ' to write a review. ',
    none: 'No written reviews yet.',
    verified: 'Verified purchase',
    you: ' (you)',
    deleteQuestion: 'Delete this review?',
    deleted: 'Review deleted',
    updated: 'Review updated',
    posted: 'Thanks! Your review is posted',
    editTitle: 'Edit your review',
    writeTitle: 'Write a review',
    rating: 'Rating',
    starChoice: (stars: number) => plural(stars, 'star', 'stars'),
    text: 'Review (optional)',
    characters: (count: number, max: number) => `${count}/${max} characters`,
    post: 'Post review'
  },
  checkout: {
    title: 'Checkout',
    itemCount: (count: number) => plural(count, 'item', 'items'),
    secure: 'Secure checkout',
    heading: 'Review your order',
    empty: 'Your cart is empty',
    deliveryDate: (date: string) => `Delivery date: ${date}`,
    chooseDelivery: 'Choose a delivery option:',
    shipping: (price: string) => `${price} - Shipping`,
    freeShipping: 'FREE Shipping',
    quantityUpdated: 'Quantity updated',
    update: 'Update',
    newQuantity: 'New quantity',
    removed: (name: string) => `${name} removed from your cart`,
    paymentSummary: 'Payment Summary',
    items: (count: number) => `Items (${count}):`,
    discount: (code: string | undefined) => `Discount (${code}):`,
    shippingHandling: 'Shipping & handling:',
    totalBeforeTax: 'Total before tax:',
    tax: 'Estimated tax (10%):',
    orderTotal: 'Order total:',
    payWithCard: 'Pay with card',
    testMode: 'Test mode:',
    testCard: 'use card 4242 4242 4242 4242 with any future date and any CVC. No real payment is made.',
    payOnDelivery: 'Pay on delivery',
    placeOrder: 'Place your order',
    orderPlaced: 'Order placed. Thank you!',
    couponExpired: (code: string) => `The coupon ${code} can no longer be used.`
  },
  coupon: {
    label: 'Coupon code',
    applied: (code: string) => `Coupon ${code} applied`,
    appliedRest: (percentOff: number) => ` applied: ${percentOff}% off your items`,
    removeLabel: (code: string) => `Remove coupon ${code}`,
    removed: 'Coupon removed',
    checkFailed: "We couldn't check this code. Please try again.",
    hintStart: 'Use ',
    hintRest: (percentOff: number) => ` for ${percentOff}% off your items.`
  },
  checkoutSuccess: {
    title: 'Confirming payment',
    heading: 'Confirming your payment',
    unpaidTitle: "Your payment didn't go through",
    unpaidDetail: 'Your cart is unchanged, so you can try again.',
    backToCheckout: 'Back to checkout',
    failedTitle: "We couldn't confirm your payment",
    failedDetail: 'If you paid, your order will appear in your orders shortly.'
  },
  orders: {
    title: 'Your Orders',
    none: "You haven't placed any orders yet",
    placed: 'Order placed',
    total: 'Total',
    payment: 'Payment',
    paidByCard: 'Paid by card',
    payOnDelivery: 'Pay on delivery',
    status: 'Status',
    orderId: 'Order ID',
    arriving: (date: string) => `Arriving on ${date}`,
    trackPackage: 'Track package',
    cancelQuestion: 'Cancel this order?',
    cancelAndRefundQuestion: 'Cancel this order and refund your payment?',
    cancelled: 'Order cancelled. Its items are back in stock',
    cancelledAndRefunded: 'Order cancelled and your payment refunded',
    cancelOrder: 'Cancel order',
    keepOrder: 'Keep order',
    cancelHint: 'You can cancel until it ships'
  },
  orderStatus: {
    processing: 'Processing',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    refunded: 'Refunded'
  },
  paymentMethods: {
    card: 'Card',
    delivery: 'On delivery'
  },
  tracking: {
    title: 'Track your package',
    progress: 'Delivery progress',
    cancelled: "This order was cancelled before it shipped, so this package won't be delivered.",
    refunded: ' Its payment was refunded.',
    notFound: "We couldn't find this package"
  },
  wishlist: {
    title: 'Your wishlist',
    link: 'Wishlist',
    save: (name: string) => `Save ${name} to your wishlist`,
    saved: (name: string) => `${name} saved to your wishlist`,
    removed: (name: string) => `${name} removed from your wishlist`,
    view: 'View wishlist',
    logInHint: 'Log in to save products to your wishlist',
    logInPrompt: 'Log in to see your wishlist',
    empty: 'Your wishlist is empty',
    emptyText: 'Tap the heart on a product to save it for later.',
    linkText: 'Products you saved for later'
  },
  account: {
    title: 'Your account',
    loginDetails: 'Login details',
    customerSince: 'Customer since',
    ordersTitle: 'Your orders',
    ordersText: 'Track packages, buy again or review what you bought',
    passwordTitle: 'Change password',
    passwordText: 'Choose a new password for this account',
    manageTitle: 'Manage the store',
    manageText: 'Products, stock and coupons',
    logOut: 'Log out',
    loggedOut: "You're logged out",
    logInPrompt: 'Log in to see your account'
  },
  login: {
    signUpTitle: 'Create your account',
    checkEmail: 'Check your email',
    confirmationStart: 'We sent a link to ',
    confirmationRest: '. Open it to confirm your account and log in.',
    intro: 'Your cart and orders are saved to your account, so they follow you to any device.',
    forgot: 'Forgot password?',
    signUp: 'Sign up',
    haveAccount: 'Already have an account?',
    newHere: 'New here?',
    createAccount: 'Create an account',
    unreachable: "We couldn't reach the login service. Check your connection and try again."
  },
  forgotPassword: {
    title: 'Reset your password',
    sentStart: 'If ',
    sentRest: ' has an account, we sent it a link to choose a new password. The link works once and expires after an hour.',
    backToLogIn: 'Back to log in',
    intro: "Enter the email you log in with, and we'll send you a link to choose a new password.",
    send: 'Send link',
    remembered: 'Remembered it?'
  },
  resetPassword: {
    title: 'Choose a new password',
    forStart: 'For ',
    forRest: '. You stay logged in on this device.',
    newPassword: 'New password',
    repeat: 'Repeat the new password',
    save: 'Save password',
    mismatch: "The passwords don't match.",
    changed: 'Your password is changed',
    expiredTitle: 'This link has expired',
    expiredText: 'A link to reset your password works once and expires after an hour. Ask for a new one and use it in this browser.',
    sendNew: 'Send a new link'
  },
  // Supabase's error codes. Others show Supabase's own English message
  authErrors: {
    invalid_credentials: 'The email or password is wrong.',
    email_not_confirmed: 'Confirm your email first, with the link we sent you.',
    user_already_exists: 'There is already an account with this email.',
    weak_password: 'Choose a stronger password.',
    same_password: 'The new password must be different from the old one.',
    email_address_invalid: 'This email address is not valid.',
    over_email_send_rate_limit: 'Too many emails were sent. Please wait a few minutes and try again.',
    over_request_rate_limit: 'Too many attempts. Please wait a few minutes and try again.'
  },
  notFound: {
    title: 'Page not found',
    text: "The page you're looking for doesn't exist or has moved."
  },
  admin: {
    title: 'Admin',
    nav: 'Admin',
    overview: 'Overview',
    orders: 'Orders',
    logInPrompt: 'Log in with an admin account to manage the store',
    forbidden: 'This page is only for admins',
    stats: {
      title: 'Store overview',
      ordersDay: 'Orders, last 24 hours',
      ordersWeek: 'Orders, last 7 days',
      revenueWeek: 'Revenue, last 7 days',
      lowStock: 'Low stock',
      allStocked: (lowStock: number) => `Every product has more than ${lowStock} in stock`,
      topProducts: 'Top products',
      sold: (units: string) => `${units} sold`,
      noSales: 'No sales yet',
      seeAll: 'See every order',
      hintRest: ". Cancelled orders don't count toward revenue or sales."
    },
    products: {
      title: 'Products',
      add: 'Add product',
      caption: (count: number) => `${plural(count, 'product', 'products')} in the store`,
      image: 'Image',
      name: 'Name',
      price: 'Price',
      stock: 'Stock',
      category: 'Category',
      keywords: 'Keywords',
      actions: 'Actions',
      editLabel: (name: string) => `Edit ${name}`,
      deleteLabel: (name: string) => `Delete ${name}`,
      deleteGroup: (name: string) => `Delete ${name}?`,
      deleteQuestion: 'Delete it from the store?',
      deleted: (name: string) => `${name} deleted from the store`,
      editTitle: 'Edit product',
      addTitle: 'Add a product',
      priceInDollars: 'Price ($)',
      chooseCategory: 'Choose a category',
      keywordsHint: 'Separated by commas, up to 10. Search finds products by these words.',
      saved: (name: string) => `${name} saved`,
      added: (name: string) => `${name} added to the store`
    },
    coupons: {
      title: 'Coupons',
      add: 'Add coupon',
      caption: (count: number) => `${plural(count, 'coupon', 'coupons')}. Customers type the code at checkout`,
      code: 'Code',
      discount: 'Discount',
      expires: 'Expires',
      status: 'Status',
      percentOff: (percentOff: number) => `${percentOff}% off`,
      never: 'Never',
      off: 'Off',
      expired: 'Expired',
      active: 'Active',
      featured: 'Featured',
      editLabel: (code: string) => `Edit ${code}`,
      editTitle: 'Edit coupon',
      addTitle: 'Add a coupon',
      codeHint: '3 to 20 letters or digits',
      percentOffLabel: 'Percent off',
      expiresAfter: 'Expires after',
      noEndDate: 'Empty for no end date',
      activeLabel: 'Active, so customers can use it',
      featuredLabel: 'Featured, so checkout suggests it',
      featuredHint: "Checkout shows the newest featured coupon that's active and hasn't expired.",
      saved: (code: string) => `Coupon ${code} saved`
    },
    orderList: {
      filters: 'Filter orders',
      status: 'Status',
      allStatuses: 'All statuses',
      payment: 'Payment',
      allPayments: 'All payments',
      count: (shown: number, total: number) => (
        shown < total ? `The newest ${shown} of ${plural(total, 'order', 'orders')}` : plural(total, 'order', 'orders')
      ),
      order: 'Order',
      customer: 'Customer',
      items: 'Items',
      total: 'Total',
      noMatch: 'No orders match these filters',
      none: 'No orders yet',
      changed: (id: string, status: string) => `Order ${id} is now ${status.toLowerCase()}`,
      markShipped: 'Mark shipped',
      markDelivered: 'Mark delivered',
      markLabel: (id: string, status: OrderStatus) => `Mark order ${id} ${status}`,
      cancelGroup: (id: string) => `Cancel order ${id}?`,
      cancelLabel: (id: string) => `Cancel order ${id}`,
      refundQuestion: 'Refund and restock?',
      cancelQuestion: 'Cancel and restock?'
    }
  },
  // What the API sends as `code` with a refusal. Other refusals show the API's English message
  apiErrors: {
    outOfStock: ({ product, inCart }: ApiErrorParams) => `${product} is out of stock.${inCart ? ` You already have ${inCart} in your cart.` : ''}`,
    lowStock: ({ product, stock, inCart }: ApiErrorParams) => (
      `Only ${stock} of ${product} left in stock.${inCart ? ` You already have ${inCart} in your cart.` : ''}`
    ),
    outOfStockInOrder: ({ product }: ApiErrorParams) => `${product} is out of stock. Remove it from your cart to continue.`,
    lowStockInOrder: ({ product, stock }: ApiErrorParams) => (
      `Only ${stock} of ${product} left in stock. Lower the quantity in your cart to continue.`
    ),
    emptyCart: () => 'Your cart is empty.',
    orderLimit: ({ max }: ApiErrorParams) => `This demo store keeps up to ${max} orders per visitor, and you've reached the limit.`,
    invalidCoupon: ({ code }: ApiErrorParams) => `${code || 'This'} isn't a valid coupon code.`,
    expiredCoupon: ({ code }: ApiErrorParams) => `The coupon ${code} has expired.`,
    couponTaken: ({ code }: ApiErrorParams) => `There's already a coupon with the code ${code}`,
    reviewNotAllowed: () => 'Only customers who ordered this product can review it.',
    alreadyReviewed: () => "You've already reviewed this product. Edit your review instead.",
    orderFinal: ({ status }: ApiErrorParams) => `This order is already ${status}.`,
    statusNotAllowed: ({ status, nextStatus }: ApiErrorParams) => `A ${status} order can't be marked ${nextStatus}.`,
    orderChanged: () => 'This order was changed meanwhile. Reload the page to see it.',
    refundUnavailable: () => "Card payments can't be refunded right now, so this order can't be cancelled.",
    refundNotAllowed: () => "This order's payment can't be refunded by the store.",
    refundFailed: () => "The refund didn't go through, so the order wasn't cancelled. Please try again later.",
    tooManyRequests: () => 'Too many requests. Please wait a few minutes and try again.'
  },
  // Shown by the browser when a form field is filled in wrong
  validation: {
    valueMissing: 'Please fill in this field.',
    typeMismatch: 'Please enter a valid email address.',
    tooShort: (minLength: number) => `Please use at least ${minLength} characters.`,
    rangeUnderflow: (min: string) => `Please enter ${min} or more.`,
    rangeOverflow: (max: string) => `Please enter ${max} or less.`,
    stepMismatch: 'Please enter a valid value.',
    badInput: 'Please enter a number.',
    patternMismatch: 'Please match the requested format.'
  }
};

export type Messages = typeof en;
