export type UserRole = 'STUDENT' | 'CANTEEN_STAFF' | 'ADMIN' | 'NGO';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  studentId?: string;
  hostel?: string;
  canteenId?: string;
  organizationName?: string;
  hasActiveMembership: boolean;
  membershipExpiry?: string;
  membershipSavingsPaise: number;
  referralCode: string;
  referralCreditsPaise: number;
  phone?: string;
  avatarUrl?: string;
  loyaltyCoins?: number;
  dietaryPreference?: string;
}

export interface Canteen {
  id: string;
  name: string;
  campus: string;
  locationDesc: string;
  openingHours: string;
  pickupSlots: string[];
  contactNumber: string;
  isOpen: boolean;
}

export interface CustomisationOption {
  name: string;
  pricePaise: number;
}

export interface CustomisationGroup {
  title: string;
  required: boolean;
  options: CustomisationOption[];
}

export interface FoodItem {
  id: string;
  canteenId: string;
  name: string;
  category: string;
  pricePaise: number; // in integer paise (₹55 = 5500)
  isVeg: boolean;
  description: string;
  ingredients: string[];
  allergens: string[];
  stockAvailable: number;
  imageEmoji: string;
  prepTimeMins: number;
  customisations?: CustomisationGroup[];
  isFeatured?: boolean;
}

export interface GroupDeal {
  id: string;
  title: string;
  foodItemId: string;
  foodItemName: string;
  regularPricePaise: number;
  groupPricePaise: number;
  currentParticipants: number;
  targetParticipants: number;
  status: 'ACTIVE' | 'UNLOCKED' | 'EXPIRED' | 'COMPLETED';
  expiresAt: string;
  participantIds: string[];
  pickupSlot: string;
  canteenName: string;
  imageEmoji: string;
}

export interface RescueMealBatch {
  id: string;
  foodItemId: string;
  foodItemName: string;
  originalPricePaise: number;
  quantityAvailable: number;
  reason: string;
  preparedAt: string;
  offerStartedAt: string;
  saleCutoff: string;
  handoverCutoff: string;
  handlingInfo: string;
  allergens: string[];
  baseDiscountPercent: number;
  currentDiscountPercent: number;
  currentPricePaise: number;
  ngoNotified: boolean;
  status: 'AVAILABLE' | 'SOLD_OUT' | 'OFFERED_TO_NGO' | 'DONATED' | 'DISCARDED';
  imageEmoji: string;
  canteenName: string;
}

export interface DonationOffer {
  id: string;
  rescueBatchId: string;
  canteenName: string;
  foodItemName: string;
  portions: number;
  handlingInfo: string;
  location: string;
  pickupCutoff: string;
  status: 'PENDING_NGO' | 'ACCEPTED' | 'DECLINED' | 'HANDED_OVER' | 'EXPIRED';
  ngoOrgName: string;
  acceptedAt?: string;
  handedOverAt?: string;
  verifiedByStaff?: string;
  imageEmoji: string;
}

export interface CartItem {
  cartItemId: string;
  foodItemId: string;
  name: string;
  pricePaise: number;
  quantity: number;
  isVeg: boolean;
  selectedOptions?: { groupTitle: string; optionName: string; pricePaise: number }[];
  isRescue?: boolean;
  rescueBatchId?: string;
  isGroupDeal?: boolean;
  groupDealId?: string;
  imageEmoji: string;
}

export interface OrderItem {
  foodItemId: string;
  name: string;
  pricePaise: number;
  quantity: number;
  isVeg: boolean;
  selectedOptions?: string[];
  isRescue?: boolean;
  isGroupDeal?: boolean;
  imageEmoji: string;
}

export type OrderPaymentStatus =
  | 'PENDING'
  | 'AWAITING_PAYMENT'
  | 'PROCESSING'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUND_PENDING'
  | 'REFUNDED';

export type OrderCollectionStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'NOT_READY'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'COLLECTED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  userName: string;
  userEmail: string;
  canteenId: string;
  canteenName: string;
  pickupCounter: string;
  items: OrderItem[];
  pickupSlot: string;
  itemTotalPaise: number;
  discountPaise: number;
  couponCode?: string;
  appliedCouponDiscountPaise: number;
  membershipDiscountPaise: number;
  referralDiscountPaise: number;
  taxesPaise: number;
  payableAmountPaise: number;
  paymentStatus: OrderPaymentStatus;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  pickupToken: string;
  pickupQrData: string;
  pickupQrUrl?: string;
  collectionStatus: OrderCollectionStatus;
  collectedAt?: string;
  collectedByStaff?: string;
  createdAt: string;
  pickupNotes?: string;
  reservationExpiresAt?: string;
  idempotencyKey?: string;
  cancellationReason?: string;
  refundId?: string;
  isDemoPayment?: boolean;
}

export interface Coupon {
  code: string;
  title: string;
  description: string;
  discountPercent?: number;
  flatDiscountPaise?: number;
  maxDiscountPaise?: number;
  minOrderPaise: number;
  expiryDate: string;
  onlyForMembership?: boolean;
}

export interface CampusEventOffer {
  id: string;
  title: string;
  tagline: string;
  bannerColor: string;
  dealHighlight: string;
  dateRange: string;
  code: string;
}

export interface PartyPreorder {
  id: string;
  studentId: string;
  studentName: string;
  contactPhone: string;
  eventTitle: string;
  eventDate: string;
  pickupTime: string;
  headCount: number;
  itemsRequested: { name: string; quantity: number }[];
  specialInstructions: string;
  status: 'PENDING_REVIEW' | 'QUOTED' | 'PAID' | 'COMPLETED' | 'REJECTED';
  quotedPricePaise?: number;
  pickupToken?: string;
  pickupQrUrl?: string;
  canteenRemarks?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorRole: UserRole | 'SYSTEM';
  actorName: string;
  action: string;
  details: string;
}

export interface PlatformMetrics {
  totalRescueMealsSold: number;
  totalDonationsHandedOver: number;
  totalRescueRevenuePaise: number;
  totalStudentSavingsPaise: number;
  totalDiscardedPortions: number;
  totalGroupDealsCompleted: number;
  verifiedPickupsCount: number;
}
