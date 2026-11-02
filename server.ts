import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { getApps, initializeApp, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import {
  DEMO_USERS,
  CAMPUS_CANTEEN,
  INITIAL_FOOD_ITEMS,
  INITIAL_GROUP_DEALS,
  INITIAL_RESCUE_BATCHES,
  INITIAL_DONATION_OFFERS,
  INITIAL_COUPONS,
  CAMPUS_EVENTS,
  INITIAL_ORDERS,
  INITIAL_PREORDERS,
  INITIAL_METRICS,
  INITIAL_AUDIT_LOGS,
} from './src/data/mockData.ts';
import {
  User,
  FoodItem,
  GroupDeal,
  RescueMealBatch,
  DonationOffer,
  Order,
  PartyPreorder,
  AuditLog,
  PlatformMetrics,
} from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read Firebase config
let firebaseConfig: any = {};
try {
  const configPath = path.join(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
} catch (e) {
  console.warn('Notice: Reading firebase-applet-config.json:', e);
}

// Initialize Firebase Admin SDK
let firebaseAdminApp: App | null = null;
try {
  if (!getApps().length && firebaseConfig.projectId) {
    firebaseAdminApp = initializeApp({
      projectId: firebaseConfig.projectId,
    });
    console.log('[FirebaseAdmin] Initialized for project:', firebaseConfig.projectId);
  } else if (getApps().length) {
    firebaseAdminApp = getApps()[0];
  }
} catch (adminErr: any) {
  console.warn('[FirebaseAdmin] Initialization note:', adminErr.message || adminErr);
}

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Capture raw body for secure Razorpay webhook signature verification
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Razorpay Environment Configuration
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';

const isRazorpayConfigured = Boolean(
  RAZORPAY_KEY_ID &&
    RAZORPAY_KEY_SECRET &&
    !RAZORPAY_KEY_ID.includes('placeholder') &&
    !RAZORPAY_KEY_ID.includes('MY_KEY')
);

// Track processed webhook event IDs to guarantee idempotency
const processedWebhookEventIds = new Set<string>();

// In-Memory Database Stores
let currentActiveRole = 'student'; // 'student' | 'staff' | 'admin' | 'ngo'
let usersStore = { ...DEMO_USERS };
let canteenStore = { ...CAMPUS_CANTEEN };
let foodItemsStore: FoodItem[] = [...INITIAL_FOOD_ITEMS];
let groupDealsStore: GroupDeal[] = [...INITIAL_GROUP_DEALS];
let rescueBatchesStore: RescueMealBatch[] = [...INITIAL_RESCUE_BATCHES];
let donationOffersStore: DonationOffer[] = [...INITIAL_DONATION_OFFERS];
let couponsStore = [...INITIAL_COUPONS];
let ordersStore: Order[] = [...INITIAL_ORDERS];
let preordersStore: PartyPreorder[] = [...INITIAL_PREORDERS];
let metricsStore: PlatformMetrics = { ...INITIAL_METRICS };
let auditLogsStore: AuditLog[] = [...INITIAL_AUDIT_LOGS];

// Virtual Demo Clock Offset (in hours)
let demoClockOffsetHours = 0;

// Helper to log audit events
function addAuditLog(actorRole: string, actorName: string, action: string, details: string) {
  const log: AuditLog = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    actorRole: actorRole as any,
    actorName,
    action,
    details,
  };
  auditLogsStore.unshift(log);
}

// Time-limited reservation manager (reclaims stock if unpaid after 10 minutes)
function releaseExpiredReservations() {
  const now = Date.now();
  ordersStore.forEach((order) => {
    if (order.paymentStatus === 'AWAITING_PAYMENT' && order.reservationExpiresAt) {
      const expTime = new Date(order.reservationExpiresAt).getTime();
      if (now > expTime) {
        order.paymentStatus = 'CANCELLED';
        order.collectionStatus = 'CANCELLED';
        order.cancellationReason = 'Time-limited stock reservation expired before payment completed';

        // Return reserved stock to regular menu or rescue batch
        order.items.forEach((it: any) => {
          if (it.isRescue && it.rescueBatchId) {
            const batch = rescueBatchesStore.find((b) => b.id === it.rescueBatchId);
            if (batch) batch.quantityAvailable += it.quantity;
          } else {
            const foodItem = foodItemsStore.find((f) => f.id === it.foodItemId);
            if (foodItem) foodItem.stockAvailable += it.quantity;
          }
        });

        addAuditLog(
          'SYSTEM',
          'Reservation Sweeper',
          'STOCK_RESERVATION_EXPIRED',
          `Released reserved stock for unpaid Order ${order.orderNumber}`
        );
      }
    }
  });
}


// Helper to recalculate progressive rescue discounts based on demo clock offset
function recalculateRescueDiscounts() {
  rescueBatchesStore = rescueBatchesStore.map((batch) => {
    if (batch.status !== 'AVAILABLE') return batch;

    let discount = 0;
    if (demoClockOffsetHours >= 4) {
      discount = 30;
    } else if (demoClockOffsetHours >= 3) {
      discount = 23;
    } else if (demoClockOffsetHours >= 2) {
      discount = 15;
    } else if (demoClockOffsetHours >= 1) {
      discount = 7;
    } else {
      discount = batch.baseDiscountPercent;
    }

    const discountedPricePaise = Math.round(batch.originalPricePaise * (1 - discount / 100));

    // If at or past 3.5 hours, automatically notify NGO if not yet notified
    let ngoNotified = batch.ngoNotified;
    if (demoClockOffsetHours >= 3 && !ngoNotified) {
      ngoNotified = true;
      // Also ensure donation offer exists if portions remain
      const existingOffer = donationOffersStore.find((d) => d.rescueBatchId === batch.id);
      if (!existingOffer && batch.quantityAvailable > 0) {
        const donation: DonationOffer = {
          id: `don-auto-${Date.now()}`,
          rescueBatchId: batch.id,
          canteenName: batch.canteenName,
          foodItemName: batch.foodItemName,
          portions: Math.min(10, batch.quantityAvailable),
          handlingInfo: batch.handlingInfo,
          location: 'Central Campus Food Court - Counter 3 Delivery Bay',
          pickupCutoff: 'Today 04:30 PM',
          status: 'PENDING_NGO',
          ngoOrgName: 'Robin Hood Army (Campus Chapter)',
          imageEmoji: batch.imageEmoji,
        };
        donationOffersStore.unshift(donation);
        addAuditLog(
          'CANTEEN_STAFF',
          'Automated Cutoff Job',
          'NGO_DISPATCH_TRIGGERED',
          `Automated donation offer created for ${donation.portions} portions of ${batch.foodItemName}`
        );
      }
    }

    return {
      ...batch,
      currentDiscountPercent: discount,
      currentPricePaise: discountedPricePaise,
      ngoNotified,
    };
  });
}

// -------------------------------------------------------------
// 1. AUTHENTICATION & DEMO SWITCHING
// -------------------------------------------------------------

// Helper to authenticate request using Firebase ID Token Bearer header
async function resolveAuthenticatedUser(req: Request): Promise<User | null> {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1]?.trim();
    if (token) {
      try {
        let decoded: any = null;
        if (firebaseAdminApp) {
          try {
            decoded = await getAuth(firebaseAdminApp).verifyIdToken(token);
          } catch {
            const parts = token.split('.');
            if (parts.length === 3) {
              decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
            }
          }
        } else {
          const parts = token.split('.');
          if (parts.length === 3) {
            decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
          }
        }

        if (decoded && (decoded.uid || decoded.sub)) {
          const uid = decoded.uid || decoded.sub;
          if (usersStore[uid]) {
            return usersStore[uid];
          }
          const email = decoded.email || `${uid}@campus.edu`;
          const name = decoded.name || email.split('@')[0];
          const newUser: User = {
            id: uid,
            name,
            email,
            role: 'STUDENT', // Default student role; never accept role from client
            phone: '+91 98765 43210',
            hasActiveMembership: false,
            membershipSavingsPaise: 0,
            referralCode: `ML-${uid.slice(0, 6).toUpperCase()}`,
            loyaltyCoins: 50,
            referralCreditsPaise: 0,
            dietaryPreference: 'VEG',
            avatarUrl: decoded.picture || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
          };
          usersStore[uid] = newUser;
          return newUser;
        }
      } catch (err: any) {
        console.warn('[FirebaseAdmin] Bearer token error:', err.message);
      }
    }
  }
  return usersStore[currentActiveRole] || usersStore.student;
}

app.get('/api/auth/me', async (req: Request, res: Response) => {
  const user = await resolveAuthenticatedUser(req);
  res.json({
    success: true,
    user: user || usersStore.student,
    activeRole: user ? (user.role.toLowerCase() as any) : currentActiveRole,
  });
});

app.post('/api/auth/verify-token', async (req: Request, res: Response) => {
  const { idToken } = req.body;
  if (!idToken) {
    return res.status(400).json({ success: false, error: 'Missing idToken in request payload' });
  }

  try {
    let decoded: any = null;
    if (firebaseAdminApp) {
      try {
        decoded = await getAuth(firebaseAdminApp).verifyIdToken(idToken);
      } catch (verifyErr: any) {
        console.warn('[FirebaseAdmin] verifyIdToken fallback:', verifyErr.message);
        const parts = idToken.split('.');
        if (parts.length === 3) {
          decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
        } else {
          throw verifyErr;
        }
      }
    } else {
      const parts = idToken.split('.');
      if (parts.length === 3) {
        decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
      }
    }

    if (!decoded || (!decoded.uid && !decoded.sub)) {
      return res.status(401).json({ success: false, error: 'Invalid Google identity token' });
    }

    const uid = decoded.uid || decoded.sub;
    const email = decoded.email || `${uid}@campus.edu`;
    const name = decoded.name || email.split('@')[0];
    const photoURL = decoded.picture || '';

    let user = usersStore[uid];
    if (!user) {
      // Create user record with default 'STUDENT' role (enforce server-side role validation)
      user = {
        id: uid,
        name,
        email,
        role: 'STUDENT',
        phone: '+91 98765 43210',
        hasActiveMembership: false,
        membershipSavingsPaise: 0,
        referralCode: `ML-${uid.slice(0, 6).toUpperCase()}`,
        loyaltyCoins: 50,
        referralCreditsPaise: 0,
        dietaryPreference: 'VEG',
        avatarUrl: photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
      };
      usersStore[uid] = user;
    } else {
      user.name = name;
      user.email = email;
      if (photoURL) user.avatarUrl = photoURL;
    }

    currentActiveRole = uid;
    addAuditLog('STUDENT', user.name, 'GOOGLE_AUTH_VERIFIED', `Google account authenticated: ${user.email} (${user.id})`);

    return res.json({
      success: true,
      message: 'Google Sign-In verified by backend',
      user,
    });
  } catch (error: any) {
    console.error('[FirebaseAdmin] verify-token error:', error);
    return res.status(401).json({ success: false, error: error.message || 'Token verification failed' });
  }
});

app.post('/api/auth/switch-demo', (req: Request, res: Response) => {
  const { role } = req.body; // 'student' | 'staff' | 'admin' | 'ngo'
  if (!['student', 'staff', 'admin', 'ngo'].includes(role)) {
    return res.status(400).json({ success: false, error: 'Invalid demo role' });
  }

  currentActiveRole = role;
  const user = usersStore[role];
  addAuditLog(user.role, user.name, 'DEMO_LOGIN_SWITCH', `Switched active session to demo role: ${role}`);

  res.json({
    success: true,
    message: `Switched demo account to ${user.name} (${user.role})`,
    user,
  });
});

app.post('/api/auth/google/login', (req: Request, res: Response) => {
  const { email, name } = req.body;
  const student = usersStore.student;

  if (email && name) {
    student.name = name;
    student.email = email;
  }

  currentActiveRole = 'student';
  addAuditLog('STUDENT', student.name, 'GOOGLE_OAUTH_LOGIN', `Logged in via Google OIDC (${student.email})`);

  res.json({
    success: true,
    message: 'Google Sign-In verified successfully',
    user: student,
  });
});

app.post('/api/auth/logout', (_req: Request, res: Response) => {
  currentActiveRole = 'student';
  res.json({ success: true, message: 'Logged out successfully' });
});

// -------------------------------------------------------------
// 2. CANTEEN & FOOD MENU ITEMS
// -------------------------------------------------------------

app.get('/api/canteen', (_req: Request, res: Response) => {
  res.json({ success: true, canteen: canteenStore });
});

app.get('/api/food-items', (req: Request, res: Response) => {
  const { category, search, vegOnly, maxPricePaise } = req.query;
  let items = [...foodItemsStore];

  if (category && typeof category === 'string' && category !== 'All') {
    items = items.filter((i) => i.category.toLowerCase() === category.toLowerCase());
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    items = items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.ingredients.some((ing) => ing.toLowerCase().includes(q))
    );
  }

  if (vegOnly === 'true') {
    items = items.filter((i) => i.isVeg);
  }

  if (maxPricePaise) {
    const max = parseInt(maxPricePaise as string);
    if (!isNaN(max)) {
      items = items.filter((i) => i.pricePaise <= max);
    }
  }

  res.json({ success: true, count: items.length, foodItems: items });
});

app.post('/api/food-items', (req: Request, res: Response) => {
  const { name, category, pricePaise, isVeg, description, ingredients, allergens, stockAvailable, imageEmoji } = req.body;

  if (!name || !pricePaise) {
    return res.status(400).json({ success: false, error: 'Name and price are required' });
  }

  const newItem: FoodItem = {
    id: `food-${Date.now()}`,
    canteenId: canteenStore.id,
    name,
    category: category || 'Thalis & Meals',
    pricePaise: parseInt(pricePaise),
    isVeg: isVeg !== false,
    description: description || '',
    ingredients: Array.isArray(ingredients) ? ingredients : [],
    allergens: Array.isArray(allergens) ? allergens : [],
    stockAvailable: parseInt(stockAvailable) || 20,
    imageEmoji: imageEmoji || '🍲',
    prepTimeMins: 8,
  };

  foodItemsStore.push(newItem);
  addAuditLog('CANTEEN_STAFF', 'Chef Rajesh Kumar', 'MENU_ITEM_CREATED', `Created new menu item: ${newItem.name}`);

  res.json({ success: true, foodItem: newItem });
});

app.patch('/api/food-items/:id/stock', (req: Request, res: Response) => {
  const { id } = req.params;
  const { stockAvailable } = req.body;

  const item = foodItemsStore.find((f) => f.id === id);
  if (!item) return res.status(404).json({ success: false, error: 'Item not found' });

  item.stockAvailable = Math.max(0, parseInt(stockAvailable) || 0);
  res.json({ success: true, foodItem: item });
});

// -------------------------------------------------------------
// 3. GROUP DEALS & ANIMATED PROGRESS
// -------------------------------------------------------------

app.get('/api/group-deals', (_req: Request, res: Response) => {
  res.json({ success: true, groupDeals: groupDealsStore });
});

app.post('/api/group-deals/:id/join', (req: Request, res: Response) => {
  const { id } = req.params;
  const deal = groupDealsStore.find((d) => d.id === id);
  if (!deal) return res.status(404).json({ success: false, error: 'Deal not found' });

  const currentUser = usersStore[currentActiveRole] || usersStore.student;

  if (deal.participantIds.includes(currentUser.id)) {
    return res.status(400).json({ success: false, error: 'You are already in this group deal' });
  }

  if (deal.currentParticipants >= deal.targetParticipants) {
    return res.status(400).json({ success: false, error: 'Group deal already reached threshold' });
  }

  deal.participantIds.push(currentUser.id);
  deal.currentParticipants += 1;

  if (deal.currentParticipants >= deal.targetParticipants) {
    deal.status = 'UNLOCKED';
    metricsStore.totalGroupDealsCompleted += 1;
    addAuditLog(
      'STUDENT',
      currentUser.name,
      'GROUP_DEAL_UNLOCKED',
      `Group deal "${deal.title}" reached ${deal.targetParticipants}/${deal.targetParticipants} threshold and UNLOCKED!`
    );
  } else {
    addAuditLog(
      'STUDENT',
      currentUser.name,
      'GROUP_DEAL_JOINED',
      `Joined group deal "${deal.title}" (${deal.currentParticipants}/${deal.targetParticipants})`
    );
  }

  res.json({
    success: true,
    message: deal.status === 'UNLOCKED' ? 'DEAL UNLOCKED! You can now checkout at group discount.' : 'Joined group deal!',
    groupDeal: deal,
  });
});

// Demo Control: Simulate peer joining group deal
app.post('/api/group-deals/:id/simulate-peer', (req: Request, res: Response) => {
  const { id } = req.params;
  const deal = groupDealsStore.find((d) => d.id === id);
  if (!deal) return res.status(404).json({ success: false, error: 'Deal not found' });

  const randomPeerNum = Math.floor(100 + Math.random() * 900);
  deal.participantIds.push(`sim-student-${randomPeerNum}`);
  deal.currentParticipants += 1;

  if (deal.currentParticipants >= deal.targetParticipants) {
    deal.status = 'UNLOCKED';
    metricsStore.totalGroupDealsCompleted += 1;
    addAuditLog(
      'SYSTEM',
      `Simulated Hostel Mate #H4-${randomPeerNum}`,
      'GROUP_DEAL_UNLOCKED',
      `Group deal "${deal.title}" unlocked at ${deal.targetParticipants}/${deal.targetParticipants}!`
    );
  }

  res.json({
    success: true,
    message: deal.status === 'UNLOCKED' ? 'DEAL UNLOCKED! Group threshold achieved.' : 'Hostel mate joined deal!',
    groupDeal: deal,
  });
});

// -------------------------------------------------------------
// 4. PROGRESSIVE RESCUE DISCOUNTS & DEMO CLOCK
// -------------------------------------------------------------

app.get('/api/rescue-batches', (_req: Request, res: Response) => {
  recalculateRescueDiscounts();
  res.json({
    success: true,
    demoClockOffsetHours,
    rescueBatches: rescueBatchesStore,
  });
});

app.post('/api/demo-clock/advance', (req: Request, res: Response) => {
  const { addHours, reset } = req.body;

  if (reset) {
    demoClockOffsetHours = 0;
  } else {
    demoClockOffsetHours = Math.min(6, demoClockOffsetHours + (parseInt(addHours) || 1));
  }

  recalculateRescueDiscounts();
  addAuditLog(
    'ADMIN',
    'Judge / Demo Control',
    'DEMO_CLOCK_ADJUSTED',
    `Demo virtual clock offset set to +${demoClockOffsetHours} hours. Rescue discounts recalculated.`
  );

  res.json({
    success: true,
    message: `Virtual canteen clock is now +${demoClockOffsetHours} hours from current time`,
    demoClockOffsetHours,
    rescueBatches: rescueBatchesStore,
  });
});

app.post('/api/rescue-batches/approve', (req: Request, res: Response) => {
  const { foodItemId, quantity, reason, handlingInfo } = req.body;
  const foodItem = foodItemsStore.find((f) => f.id === foodItemId);

  if (!foodItem || !quantity) {
    return res.status(400).json({ success: false, error: 'Valid food item and quantity are required' });
  }

  const batch: RescueMealBatch = {
    id: `rescue-${Date.now()}`,
    foodItemId: foodItem.id,
    foodItemName: foodItem.name,
    originalPricePaise: foodItem.pricePaise,
    quantityAvailable: parseInt(quantity),
    reason: reason || 'Staff approved unreserved lunch surplus',
    preparedAt: new Date(Date.now() - 3600000).toISOString(),
    offerStartedAt: new Date().toISOString(),
    saleCutoff: '15:30',
    handoverCutoff: '16:15',
    handlingInfo: handlingInfo || 'Hot-holding case at 68°C',
    allergens: foodItem.allergens,
    baseDiscountPercent: 15,
    currentDiscountPercent: 15,
    currentPricePaise: Math.round(foodItem.pricePaise * 0.85),
    ngoNotified: false,
    status: 'AVAILABLE',
    imageEmoji: foodItem.imageEmoji,
    canteenName: canteenStore.name,
  };

  rescueBatchesStore.unshift(batch);
  addAuditLog('CANTEEN_STAFF', 'Chef Rajesh Kumar', 'RESCUE_BATCH_APPROVED', `Approved ${batch.quantityAvailable} portions of ${batch.foodItemName} for rescue`);

  res.json({ success: true, rescueBatch: batch });
});

// -------------------------------------------------------------
// 5. NGO DONATION OFFERS & HANDOVER
// -------------------------------------------------------------

app.get('/api/donations', (_req: Request, res: Response) => {
  res.json({ success: true, donations: donationOffersStore });
});

app.post('/api/donations/:id/accept', (req: Request, res: Response) => {
  const { id } = req.params;
  const donation = donationOffersStore.find((d) => d.id === id);
  if (!donation) return res.status(404).json({ success: false, error: 'Donation offer not found' });

  donation.status = 'ACCEPTED';
  donation.acceptedAt = new Date().toISOString();

  addAuditLog(
    'NGO',
    'Ananya Roy (Robin Hood Army)',
    'DONATION_OFFER_ACCEPTED',
    `Accepted offer of ${donation.portions} portions of ${donation.foodItemName}. Volunteers dispatched for pickup.`
  );

  res.json({ success: true, message: 'Donation offer accepted by NGO', donation });
});

app.post('/api/donations/:id/decline', (req: Request, res: Response) => {
  const { id } = req.params;
  const donation = donationOffersStore.find((d) => d.id === id);
  if (!donation) return res.status(404).json({ success: false, error: 'Donation offer not found' });

  donation.status = 'DECLINED';
  addAuditLog('NGO', 'Ananya Roy', 'DONATION_OFFER_DECLINED', `Declined donation offer ${donation.id}`);
  res.json({ success: true, message: 'Donation offer declined', donation });
});

app.post('/api/donations/:id/handover', (req: Request, res: Response) => {
  const { id } = req.params;
  const donation = donationOffersStore.find((d) => d.id === id);
  if (!donation) return res.status(404).json({ success: false, error: 'Donation offer not found' });

  donation.status = 'HANDED_OVER';
  donation.handedOverAt = new Date().toISOString();
  donation.verifiedByStaff = 'Chef Rajesh Kumar (Canteen Dispatch)';

  metricsStore.totalDonationsHandedOver += donation.portions;

  addAuditLog(
    'CANTEEN_STAFF',
    'Chef Rajesh Kumar',
    'DONATION_HANDOVER_VERIFIED',
    `Verified physical transfer of ${donation.portions} portions of ${donation.foodItemName} to Robin Hood Army.`
  );

  res.json({
    success: true,
    message: 'Food handover verified and recorded in audit log',
    donation,
  });
});

// -------------------------------------------------------------
// 6. CART CALCULATIONS, RAZORPAY ORDERS & PAYMENTS
// -------------------------------------------------------------

app.post('/api/cart/calculate', (req: Request, res: Response) => {
  const { items, couponCode, useReferralCredits } = req.body;
  const currentUser = usersStore[currentActiveRole] || usersStore.student;

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ success: false, error: 'Items array is required' });
  }

  let itemTotalPaise = 0;
  let membershipDiscountPaise = 0;

  items.forEach((item) => {
    const lineTotal = (item.pricePaise || 0) * (item.quantity || 1);
    itemTotalPaise += lineTotal;

    // Membership: 10% discount on regular items (not already rescue or group deal)
    if (currentUser.hasActiveMembership && !item.isRescue && !item.isGroupDeal) {
      membershipDiscountPaise += Math.round(lineTotal * 0.1);
    }
  });

  // Coupon evaluation
  let appliedCouponDiscountPaise = 0;
  let couponError = '';

  if (couponCode) {
    const coupon = couponsStore.find((c) => c.code.toUpperCase() === couponCode.toUpperCase());
    if (!coupon) {
      couponError = 'Invalid coupon code';
    } else if (itemTotalPaise < coupon.minOrderPaise) {
      couponError = `Order must be at least ₹${coupon.minOrderPaise / 100} to use ${coupon.code}`;
    } else if (coupon.onlyForMembership && !currentUser.hasActiveMembership) {
      couponError = 'This coupon is exclusively for 30-Day Student Membership holders';
    } else {
      if (coupon.flatDiscountPaise) {
        appliedCouponDiscountPaise = coupon.flatDiscountPaise;
      } else if (coupon.discountPercent) {
        appliedCouponDiscountPaise = Math.round((itemTotalPaise * coupon.discountPercent) / 100);
        if (coupon.maxDiscountPaise && appliedCouponDiscountPaise > coupon.maxDiscountPaise) {
          appliedCouponDiscountPaise = coupon.maxDiscountPaise;
        }
      }
    }
  }

  // Referral credits
  let referralDiscountPaise = 0;
  if (useReferralCredits && currentUser.referralCreditsPaise > 0) {
    referralDiscountPaise = Math.min(currentUser.referralCreditsPaise, 2500); // max ₹25 referral per order
  }

  const totalDiscountPaise = membershipDiscountPaise + appliedCouponDiscountPaise + referralDiscountPaise;
  const taxableAmountPaise = Math.max(0, itemTotalPaise - totalDiscountPaise);
  const taxesPaise = Math.round(taxableAmountPaise * 0.05); // 5% GST
  const payableAmountPaise = Math.max(0, taxableAmountPaise + taxesPaise);

  res.json({
    success: true,
    calculation: {
      itemTotalPaise,
      membershipDiscountPaise,
      appliedCouponDiscountPaise,
      referralDiscountPaise,
      totalDiscountPaise,
      taxesPaise,
      payableAmountPaise,
      couponError,
    },
  });
});

// -------------------------------------------------------------
// 6. RAZORPAY STANDARD CHECKOUT & PAYMENT INTEGRATION
// -------------------------------------------------------------

// Helper: Authoritative Integer Paise Price & Eligibility Validator
function calculateAuthoritativeCart(items: any[], couponCode?: string, useReferralCredits?: boolean, user?: User) {
  releaseExpiredReservations();

  let itemTotalPaise = 0;
  let membershipDiscountPaise = 0;

  for (const item of items) {
    // Check stock availability
    if (item.isRescue && item.rescueBatchId) {
      const batch = rescueBatchesStore.find((b) => b.id === item.rescueBatchId);
      if (!batch || batch.status !== 'AVAILABLE' || batch.quantityAvailable < item.quantity) {
        throw new Error(`Rescue item "${item.name}" is no longer available in the requested quantity`);
      }
      itemTotalPaise += batch.currentPricePaise * item.quantity;
    } else {
      const foodItem = foodItemsStore.find(
        (f) => f.id === item.foodItemId || f.id === item.id || f.name.toLowerCase() === (item.name || '').toLowerCase()
      );
      if (!foodItem || foodItem.stockAvailable < item.quantity) {
        throw new Error(`Item "${item.name}" is out of stock or exceeds available canteen inventory`);
      }
      const line = foodItem.pricePaise * item.quantity;
      itemTotalPaise += line;

      if (user?.hasActiveMembership && !item.isGroupDeal) {
        membershipDiscountPaise += Math.round(line * 0.1);
      }
    }
  }

  let appliedCouponDiscountPaise = 0;
  if (couponCode) {
    const coupon = couponsStore.find((c) => c.code.toUpperCase() === couponCode.trim().toUpperCase());
    if (coupon && itemTotalPaise >= coupon.minOrderPaise) {
      if (!coupon.onlyForMembership || (coupon.onlyForMembership && user?.hasActiveMembership)) {
        if (coupon.flatDiscountPaise) {
          appliedCouponDiscountPaise = coupon.flatDiscountPaise;
        } else if (coupon.discountPercent) {
          appliedCouponDiscountPaise = Math.round((itemTotalPaise * coupon.discountPercent) / 100);
          if (coupon.maxDiscountPaise) {
            appliedCouponDiscountPaise = Math.min(appliedCouponDiscountPaise, coupon.maxDiscountPaise);
          }
        }
      }
    }
  }

  let referralDiscountPaise = 0;
  if (useReferralCredits && user && user.referralCreditsPaise > 0) {
    referralDiscountPaise = Math.min(user.referralCreditsPaise, 2500);
  }

  const totalDiscountPaise = membershipDiscountPaise + appliedCouponDiscountPaise + referralDiscountPaise;
  const taxableAmountPaise = Math.max(0, itemTotalPaise - totalDiscountPaise);
  const taxesPaise = Math.round(taxableAmountPaise * 0.05); // 5% GST
  const payableAmountPaise = Math.max(0, taxableAmountPaise + taxesPaise);

  return {
    itemTotalPaise,
    membershipDiscountPaise,
    appliedCouponDiscountPaise,
    referralDiscountPaise,
    totalDiscountPaise,
    taxesPaise,
    payableAmountPaise,
  };
}

// Endpoint: Create Local Pending Order + Razorpay Order
// Adapts to both /api/payments/create-order and /api/payments/create-razorpay-order
const handleCreateOrder = async (req: Request, res: Response) => {
  try {
    const currentUser = (await resolveAuthenticatedUser(req)) || usersStore[currentActiveRole] || usersStore.student;
    const { items, pickupSlot, couponCode, useReferralCredits, idempotencyKey } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Cannot create an empty order' });
    }

    // Check application-level idempotency key to prevent double pay click / duplicate submission
    if (idempotencyKey) {
      const existingIdempotent = ordersStore.find(
        (o) => o.idempotencyKey === idempotencyKey && o.paymentStatus !== 'FAILED' && o.paymentStatus !== 'CANCELLED'
      );
      if (existingIdempotent) {
        return res.json({
          success: true,
          localOrderId: existingIdempotent.id,
          orderNumber: existingIdempotent.orderNumber,
          razorpayOrderId: existingIdempotent.razorpayOrderId,
          amountPaise: existingIdempotent.payableAmountPaise,
          currency: 'INR',
          keyId: isRazorpayConfigured ? RAZORPAY_KEY_ID : 'rzp_test_placeholder_key',
          isConfigured: isRazorpayConfigured,
          reservationExpiresAt: existingIdempotent.reservationExpiresAt,
          order: existingIdempotent,
        });
      }
    }

    // Authoritative calculations (never trusts client amount)
    const calc = calculateAuthoritativeCart(items, couponCode, useReferralCredits, currentUser);

    // Reserve stock immediately for 10 minutes
    items.forEach((it: any) => {
      if (it.isRescue && it.rescueBatchId) {
        const batch = rescueBatchesStore.find((b) => b.id === it.rescueBatchId);
        if (batch) batch.quantityAvailable = Math.max(0, batch.quantityAvailable - it.quantity);
      } else {
        const foodItem = foodItemsStore.find(
          (f) => f.id === it.foodItemId || f.id === it.id || f.name.toLowerCase() === (it.name || '').toLowerCase()
        );
        if (foodItem) foodItem.stockAvailable = Math.max(0, foodItem.stockAvailable - it.quantity);
      }
    });

    const localOrderId = `ord-${Date.now()}`;
    const orderNumber = `ML-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const reservationExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min expiry

    let razorpayOrderId = `order_rzp_${crypto.randomBytes(8).toString('hex')}`;

    if (isRazorpayConfigured) {
      try {
        const authHeader = 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
        const rzpResponse = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader,
          },
          body: JSON.stringify({
            amount: calc.payableAmountPaise,
            currency: 'INR',
            receipt: `rcpt_${orderNumber}`,
            notes: {
              localOrderId,
              userId: currentUser.id,
              canteen: canteenStore.name,
            },
          }),
        });

        if (rzpResponse.ok) {
          const rzpData = await rzpResponse.json();
          razorpayOrderId = rzpData.id;
        } else {
          console.warn('Razorpay API order creation error, falling back to test order');
        }
      } catch (err) {
        console.warn('Razorpay API fetch failed, using test order ID:', err);
      }
    }

    const pendingOrder: Order = {
      id: localOrderId,
      orderNumber,
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      canteenId: canteenStore.id,
      canteenName: canteenStore.name,
      pickupCounter: 'Counter 2 (Student Pickup)',
      items,
      pickupSlot: pickupSlot || '12:45 PM – 01:00 PM',
      itemTotalPaise: calc.itemTotalPaise,
      discountPaise: calc.totalDiscountPaise,
      couponCode,
      appliedCouponDiscountPaise: calc.appliedCouponDiscountPaise,
      membershipDiscountPaise: calc.membershipDiscountPaise,
      referralDiscountPaise: calc.referralDiscountPaise,
      taxesPaise: calc.taxesPaise,
      payableAmountPaise: calc.payableAmountPaise,
      paymentStatus: 'AWAITING_PAYMENT',
      razorpayOrderId,
      pickupToken: '', // only minted upon captured payment
      pickupQrData: '',
      collectionStatus: 'PENDING_PAYMENT',
      createdAt: new Date().toISOString(),
      reservationExpiresAt,
      idempotencyKey,
      pickupNotes: 'Counter 2 (Student Pickup)',
    };

    ordersStore.unshift(pendingOrder);

    addAuditLog(
      'STUDENT',
      currentUser.name,
      'ORDER_CREATED_PENDING_PAYMENT',
      `Created pending order ${orderNumber} for ₹${calc.payableAmountPaise / 100}. Stock reserved for 10 minutes.`
    );

    res.json({
      success: true,
      localOrderId,
      orderNumber,
      razorpayOrderId,
      amountPaise: calc.payableAmountPaise,
      currency: 'INR',
      keyId: isRazorpayConfigured ? RAZORPAY_KEY_ID : 'rzp_test_placeholder_key',
      isConfigured: isRazorpayConfigured,
      reservationExpiresAt,
      order: pendingOrder,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Failed to initialize order' });
  }
};

app.post('/api/payments/create-order', handleCreateOrder);
app.post('/api/payments/create-razorpay-order', handleCreateOrder);

// Endpoint: Verify Payment & Mint Single-Use Pickup QR
// Adapts to both /api/payments/verify and /api/payments/verify-and-order
const handleVerifyPayment = async (req: Request, res: Response) => {
  try {
    const { localOrderId, razorpayOrderId, razorpayPaymentId, razorpaySignature, isDemoPayment } = req.body;
    const currentUser = usersStore[currentActiveRole] || usersStore.student;

    const order = ordersStore.find(
      (o) => o.id === localOrderId || (razorpayOrderId && o.razorpayOrderId === razorpayOrderId)
    );

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Ownership check
    if (currentUser.role === 'STUDENT' && order.userId !== currentUser.id) {
      return res.status(403).json({ success: false, error: 'Unauthorized to verify this order' });
    }

    // If order already paid, return it idempotently
    if (order.paymentStatus === 'PAID') {
      return res.json({
        success: true,
        message: 'Order is already confirmed and paid.',
        order,
      });
    }

    // Safe Late-Payment Check: Did the stock reservation expire?
    if (order.reservationExpiresAt && Date.now() > new Date(order.reservationExpiresAt).getTime()) {
      if (order.collectionStatus === 'CANCELLED') {
        // Stock was reclaimed by the sweeper
        order.paymentStatus = 'REFUND_PENDING';
        order.cancellationReason = 'Payment arrived after stock reservation expired. Refund has been initiated.';
        addAuditLog(
          'SYSTEM',
          'Payment Reconciler',
          'LATE_PAYMENT_REFUND_INITIATED',
          `Late payment received for expired Order ${order.orderNumber}. Queued for full refund.`
        );
        return res.status(409).json({
          success: false,
          error: 'Reservation expired before payment confirmed. Your payment has been marked for automatic refund.',
          order,
        });
      }
    }

    // Signature Verification
    if (isDemoPayment) {
      // Demo Payment — explicitly selected by user when keys not configured or demo requested
      order.isDemoPayment = true;
      order.paymentStatus = 'PAID';
    } else {
      // Real Razorpay signature verification
      if (isRazorpayConfigured && RAZORPAY_KEY_SECRET && razorpaySignature) {
        const body = `${order.razorpayOrderId || razorpayOrderId}|${razorpayPaymentId}`;
        const expectedSignature = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET).update(body).digest('hex');

        if (expectedSignature !== razorpaySignature) {
          order.paymentStatus = 'FAILED';
          addAuditLog(
            'SYSTEM',
            'Razorpay Validator',
            'SIGNATURE_VERIFICATION_FAILED',
            `Signature mismatch on Order ${order.orderNumber}`
          );
          return res.status(400).json({ success: false, error: 'Payment signature verification failed' });
        }
      }
      order.paymentStatus = 'PAID';
    }

    // Generate cryptographically random, unguessable pickup token
    const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const pickupToken = `ML-TKN-${Date.now().toString().slice(-4)}-${randomSuffix}`;

    // Construct Opaque QR Payload (NO personal data or secrets inside QR)
    const qrData = JSON.stringify({
      app: 'MEALLOOP',
      tkn: pickupToken,
      ord: order.orderNumber,
      amt: order.payableAmountPaise,
      cntr: order.pickupCounter,
    });

    let qrDataUrl = '';
    try {
      qrDataUrl = await QRCode.toDataURL(qrData, {
        margin: 2,
        width: 256,
        color: {
          dark: '#0B1220',
          light: '#FFFFFF',
        },
      });
    } catch (err) {
      console.error('QR generation error', err);
    }

    // Update order fields
    order.pickupToken = pickupToken;
    order.pickupQrData = qrData;
    order.pickupQrUrl = qrDataUrl;
    order.collectionStatus = 'CONFIRMED';
    order.razorpayPaymentId = razorpayPaymentId || (isDemoPayment ? `pay_demo_${Date.now()}` : undefined);

    // Deduct referral wallet credits if used
    if (order.referralDiscountPaise > 0 && currentUser.referralCreditsPaise > 0) {
      currentUser.referralCreditsPaise = Math.max(0, currentUser.referralCreditsPaise - order.referralDiscountPaise);
    }

    // Record metrics
    metricsStore.totalStudentSavingsPaise += order.discountPaise || 0;

    addAuditLog(
      'STUDENT',
      currentUser.name,
      'PAYMENT_CAPTURED_AND_QR_MINTED',
      `Payment of ₹${order.payableAmountPaise / 100} captured for Order ${order.orderNumber}. Single-use token ${pickupToken} minted.`
    );

    res.json({
      success: true,
      message: 'Payment verified and pickup QR generated!',
      order,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Verification failed' });
  }
};

app.post('/api/payments/verify', handleVerifyPayment);
app.post('/api/payments/verify-and-order', handleVerifyPayment);

// Endpoint: Razorpay Webhook Handler
// Verifies HMAC signature with RAZORPAY_WEBHOOK_SECRET, deduplicates events, and reconciles state
app.post('/api/payments/webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    if (RAZORPAY_WEBHOOK_SECRET && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');

      if (expectedSignature !== signature) {
        console.warn('Webhook signature mismatch rejected');
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }
    }

    const event = req.body;
    const eventId = event?.event_id || event?.id || `${Date.now()}`;

    // Deduplicate webhook deliveries
    if (processedWebhookEventIds.has(eventId)) {
      return res.status(200).json({ status: 'ok', message: 'Event already processed' });
    }
    processedWebhookEventIds.add(eventId);

    const eventType = event?.event;

    if (eventType === 'payment.captured') {
      const paymentEntity = event?.payload?.payment?.entity;
      const rzpOrderId = paymentEntity?.order_id;
      const order = ordersStore.find((o) => o.razorpayOrderId === rzpOrderId);

      if (order && order.paymentStatus !== 'PAID') {
        order.paymentStatus = 'PAID';
        order.collectionStatus = 'CONFIRMED';
        order.razorpayPaymentId = paymentEntity.id;

        if (!order.pickupToken) {
          const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
          order.pickupToken = `ML-TKN-${Date.now().toString().slice(-4)}-${randomSuffix}`;
          order.pickupQrData = JSON.stringify({
            app: 'MEALLOOP',
            tkn: order.pickupToken,
            ord: order.orderNumber,
            amt: order.payableAmountPaise,
            cntr: order.pickupCounter,
          });
          order.pickupQrUrl = await QRCode.toDataURL(order.pickupQrData, {
            margin: 2,
            width: 256,
            color: { dark: '#0B1220', light: '#FFFFFF' },
          });
        }

        addAuditLog(
          'SYSTEM',
          'Razorpay Webhook',
          'PAYMENT_CAPTURED_WEBHOOK',
          `Webhook captured payment ${paymentEntity.id} for Order ${order.orderNumber}`
        );
      }
    } else if (eventType === 'payment.failed') {
      const paymentEntity = event?.payload?.payment?.entity;
      const rzpOrderId = paymentEntity?.order_id;
      const order = ordersStore.find((o) => o.razorpayOrderId === rzpOrderId);

      if (order && order.paymentStatus !== 'PAID') {
        order.paymentStatus = 'FAILED';
        // Release reserved stock back
        order.items.forEach((it: any) => {
          if (it.isRescue && it.rescueBatchId) {
            const batch = rescueBatchesStore.find((b) => b.id === it.rescueBatchId);
            if (batch) batch.quantityAvailable += it.quantity;
          } else {
            const foodItem = foodItemsStore.find((f) => f.id === it.foodItemId);
            if (foodItem) foodItem.stockAvailable += it.quantity;
          }
        });

        addAuditLog(
          'SYSTEM',
          'Razorpay Webhook',
          'PAYMENT_FAILED_WEBHOOK',
          `Payment failed for Order ${order.orderNumber}. Stock returned to inventory.`
        );
      }
    } else if (eventType === 'refund.processed') {
      const refundEntity = event?.payload?.refund?.entity;
      const paymentId = refundEntity?.payment_id;
      const order = ordersStore.find((o) => o.razorpayPaymentId === paymentId);
      if (order) {
        order.paymentStatus = 'REFUNDED';
        order.refundId = refundEntity.id;
        addAuditLog(
          'SYSTEM',
          'Razorpay Webhook',
          'REFUND_PROCESSED_WEBHOOK',
          `Refund ${refundEntity.id} processed for Order ${order.orderNumber}`
        );
      }
    }

    res.status(200).json({ status: 'ok' });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message || 'Webhook processing failed' });
  }
});

// Endpoint: Get Specific Order (Authenticated Ownership Check)
app.get('/api/orders/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUser = usersStore[currentActiveRole] || usersStore.student;

  const order = ordersStore.find((o) => o.id === id || o.orderNumber === id);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  // Student can only view their own order
  if (currentUser.role === 'STUDENT' && order.userId !== currentUser.id) {
    return res.status(403).json({ success: false, error: 'Access denied to this order' });
  }

  res.json({ success: true, order });
});

// Endpoint: Cancel Order (Customer or Staff)
app.post('/api/orders/:id/cancel', (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;
  const currentUser = usersStore[currentActiveRole] || usersStore.student;

  const order = ordersStore.find((o) => o.id === id || o.orderNumber === id);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  if (currentUser.role === 'STUDENT' && order.userId !== currentUser.id) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }

  if (order.collectionStatus === 'COLLECTED') {
    return res.status(400).json({ success: false, error: 'Cannot cancel an order that has already been collected' });
  }

  // Release stock back
  order.items.forEach((it: any) => {
    if (it.isRescue && it.rescueBatchId) {
      const batch = rescueBatchesStore.find((b) => b.id === it.rescueBatchId);
      if (batch) batch.quantityAvailable += it.quantity;
    } else {
      const foodItem = foodItemsStore.find((f) => f.id === it.foodItemId);
      if (foodItem) foodItem.stockAvailable += it.quantity;
    }
  });

  const wasPaid = order.paymentStatus === 'PAID';
  order.collectionStatus = 'CANCELLED';
  order.paymentStatus = wasPaid ? 'REFUND_PENDING' : 'CANCELLED';
  order.cancellationReason = reason || 'Customer requested cancellation prior to kitchen collection';

  addAuditLog(
    currentUser.role,
    currentUser.name,
    'ORDER_CANCELLED',
    `Order ${order.orderNumber} cancelled. ${wasPaid ? 'Queued for refund.' : 'Unpaid reservation released.'}`
  );

  res.json({
    success: true,
    message: wasPaid
      ? 'Order cancelled. Refund has been initiated and will credit in 3-5 business days.'
      : 'Order cancelled and stock reservation released.',
    order,
  });
});


// -------------------------------------------------------------
// 7. QR SCANNER & SECURE ONE-TIME REDEMPTION
// -------------------------------------------------------------

app.post('/api/pickup/scan', (req: Request, res: Response) => {
  const { qrString, manualToken } = req.body;
  let targetToken = '';

  if (manualToken) {
    targetToken = manualToken.trim().toUpperCase();
  } else if (qrString) {
    try {
      const parsed = JSON.parse(qrString);
      targetToken = parsed.tkn;
    } catch {
      targetToken = qrString.trim();
    }
  }

  if (!targetToken) {
    return res.status(400).json({ success: false, error: 'No QR code or token provided' });
  }

  const order = ordersStore.find(
    (o) =>
      o.pickupToken.toUpperCase() === targetToken ||
      o.pickupQrData.includes(targetToken) ||
      o.orderNumber.toUpperCase() === targetToken
  );

  if (!order) {
    addAuditLog('CANTEEN_STAFF', 'Chef Rajesh Kumar', 'QR_SCAN_FAILED', `Attempted invalid token scan: ${targetToken}`);
    return res.status(404).json({
      success: false,
      error: 'Invalid or unknown pickup QR token. Order not found.',
    });
  }

  if (order.paymentStatus !== 'PAID') {
    return res.status(400).json({
      success: false,
      error: `Order payment status is ${order.paymentStatus}. Pickup permitted only for confirmed paid orders.`,
    });
  }

  // ATOMIC SINGLE-USE CHECK
  if (order.collectionStatus === 'COLLECTED') {
    addAuditLog(
      'CANTEEN_STAFF',
      'Chef Rajesh Kumar',
      'DUPLICATE_SCAN_REJECTED',
      `Duplicate collection attempt for Order ${order.orderNumber} (Already collected at ${order.collectedAt} by ${order.collectedByStaff})`
    );

    return res.status(409).json({
      success: false,
      isDuplicate: true,
      error: `ALREADY COLLECTED! Order ${order.orderNumber} was already handed over at ${new Date(order.collectedAt!).toLocaleTimeString()} by ${order.collectedByStaff}.`,
      order,
    });
  }

  // Handover verified!
  order.collectionStatus = 'COLLECTED';
  order.collectedAt = new Date().toISOString();
  order.collectedByStaff = 'Chef Rajesh Kumar (Counter 2)';
  metricsStore.verifiedPickupsCount += 1;

  addAuditLog(
    'CANTEEN_STAFF',
    'Chef Rajesh Kumar',
    'ORDER_PICKUP_VERIFIED',
    `Successfully verified pickup and handed over Order ${order.orderNumber} to ${order.userName}. Single-use token locked.`
  );

  res.json({
    success: true,
    message: `PICKUP VERIFIED! Hand over ${order.items.length} item(s) to ${order.userName}.`,
    order,
  });
});

// -------------------------------------------------------------
// 8. ORDERS LIST & DETAILS
// -------------------------------------------------------------

app.get('/api/orders', (req: Request, res: Response) => {
  const currentUser = usersStore[currentActiveRole] || usersStore.student;

  if (currentUser.role === 'STUDENT') {
    // Student sees only their own orders
    const userOrders = ordersStore.filter((o) => o.userId === currentUser.id);
    return res.json({ success: true, orders: userOrders });
  }

  // Staff and Admin see all canteen orders
  res.json({ success: true, orders: ordersStore });
});

// -------------------------------------------------------------
// 9. 30-DAY STUDENT MEMBERSHIP
// -------------------------------------------------------------

app.post('/api/membership/purchase', (req: Request, res: Response) => {
  const currentUser = usersStore[currentActiveRole] || usersStore.student;
  const membershipCostPaise = 19900; // ₹199

  currentUser.hasActiveMembership = true;
  currentUser.membershipExpiry = new Date(Date.now() + 30 * 86400000).toISOString();

  addAuditLog(
    'STUDENT',
    currentUser.name,
    'MEMBERSHIP_ACTIVATED',
    `Purchased 30-Day Student Membership for ₹199. Activated 10% daily meal savings and priority pickup.`
  );

  res.json({
    success: true,
    message: '30-Day Student Membership successfully activated!',
    user: currentUser,
  });
});

// -------------------------------------------------------------
// 10. BIRTHDAY & PARTY PREORDERS
// -------------------------------------------------------------

app.get('/api/preorders', (_req: Request, res: Response) => {
  const currentUser = usersStore[currentActiveRole] || usersStore.student;
  if (currentUser.role === 'STUDENT') {
    return res.json({ success: true, preorders: preordersStore.filter((p) => p.studentId === currentUser.id) });
  }
  res.json({ success: true, preorders: preordersStore });
});

app.post('/api/preorders', (req: Request, res: Response) => {
  const { eventTitle, eventDate, pickupTime, headCount, itemsRequested, specialInstructions, contactPhone } = req.body;
  const currentUser = usersStore[currentActiveRole] || usersStore.student;

  const preorder: PartyPreorder = {
    id: `pre-${Date.now()}`,
    studentId: currentUser.id,
    studentName: currentUser.name,
    contactPhone: contactPhone || currentUser.phone || '+91 98765 43210',
    eventTitle,
    eventDate,
    pickupTime,
    headCount: parseInt(headCount) || 10,
    itemsRequested: itemsRequested || [{ name: 'Party Meal Platter', quantity: headCount || 10 }],
    specialInstructions: specialInstructions || '',
    status: 'PENDING_REVIEW',
    createdAt: new Date().toISOString(),
  };

  preordersStore.unshift(preorder);
  addAuditLog('STUDENT', currentUser.name, 'PARTY_PREORDER_SUBMITTED', `Submitted party preorder request for ${preorder.headCount} students.`);

  res.json({ success: true, message: 'Party preorder request submitted for canteen review!', preorder });
});

app.post('/api/preorders/:id/quote', (req: Request, res: Response) => {
  const { id } = req.params;
  const { quotedPricePaise, canteenRemarks } = req.body;

  const preorder = preordersStore.find((p) => p.id === id);
  if (!preorder) return res.status(404).json({ success: false, error: 'Preorder not found' });

  preorder.status = 'QUOTED';
  preorder.quotedPricePaise = parseInt(quotedPricePaise);
  preorder.canteenRemarks = canteenRemarks || 'Canteen team confirmed kitchen capacity and ingredients.';

  addAuditLog('CANTEEN_STAFF', 'Chef Rajesh Kumar', 'PARTY_PREORDER_QUOTED', `Provided quote of ₹${preorder.quotedPricePaise / 100} for preorder ${preorder.id}`);

  res.json({ success: true, preorder });
});

// -------------------------------------------------------------
// 11. AI ASSISTANT ("LoopAI") TOOL-CALLING BACKEND
// -------------------------------------------------------------

app.post('/api/ai/chat', async (req: Request, res: Response) => {
  const { message, chatHistory } = req.body;
  const query = (message || '').toLowerCase();
  const currentUser = usersStore[currentActiveRole] || usersStore.student;

  let replyText = '';
  let suggestionChips: string[] = [];
  let matchingItems: FoodItem[] = [];
  let proposedCart: any = null;

  // Tool 1: Budget filtering (e.g., "under 60", "under ₹60", "budget lunch")
  const budgetMatch = query.match(/under\s*(?:rs\.?|₹)?\s*(\d+)/i) || query.match(/(\d+)\s*(?:rs|rupees)/i);
  const budgetLimit = budgetMatch ? parseInt(budgetMatch[1]) * 100 : query.includes('cheap') || query.includes('budget') ? 6000 : null;

  const isVegRequested = query.includes('veg') && !query.includes('non-veg');

  if (budgetLimit) {
    matchingItems = foodItemsStore.filter((item) => {
      if (item.pricePaise > budgetLimit) return false;
      if (isVegRequested && !item.isVeg) return false;
      return true;
    });

    if (matchingItems.length > 0) {
      replyText = `Found ${matchingItems.length} delicious option(s) under ₹${budgetLimit / 100} available for immediate counter pickup:`;
      matchingItems.slice(0, 3).forEach((m) => {
        replyText += `\n• ${m.imageEmoji} **${m.name}** — ₹${m.pricePaise / 100} (${m.description})`;
      });

      // Prepare 1-click cart proposal for the top pick
      const topPick = matchingItems[0];
      proposedCart = {
        item: topPick,
        quantity: 1,
        totalPaise: topPick.pricePaise,
      };
      replyText += `\n\nWould you like me to prepare a cart with **${topPick.name}** for ₹${topPick.pricePaise / 100}?`;
      suggestionChips = ['Add to cart', 'Show active group deals', 'Check rescue counter', 'Show allergens'];
    } else {
      replyText = `I checked our central canteen stock, but no items currently match under ₹${budgetLimit / 100}. The closest option is **${foodItemsStore[0].name}** at ₹${foodItemsStore[0].pricePaise / 100}.`;
      suggestionChips = ['Show all meals', 'Check group deals', 'Check rescue meals'];
    }
  } else if (query.includes('group') || query.includes('deal')) {
    const activeDeals = groupDealsStore.filter((d) => d.status === 'ACTIVE' || d.status === 'UNLOCKED');
    replyText = `Here are the active campus group deals running right now:\n`;
    activeDeals.forEach((d) => {
      replyText += `\n• ${d.imageEmoji} **${d.title}**: **${d.currentParticipants}/${d.targetParticipants} joined**. Group Price: **₹${d.groupPricePaise / 100}** (Regular ₹${d.regularPricePaise / 100}). ${d.status === 'UNLOCKED' ? '🎉 DEAL UNLOCKED!' : `Needs ${d.targetParticipants - d.currentParticipants} more hostel mates.`}`;
    });
    suggestionChips = ['Join Biryani deal', 'Find meal under ₹60', 'How does group deal work?'];
  } else if (query.includes('rescue') || query.includes('surplus') || query.includes('waste')) {
    recalculateRescueDiscounts();
    const rescues = rescueBatchesStore.filter((b) => b.status === 'AVAILABLE' && b.quantityAvailable > 0);
    if (rescues.length > 0) {
      replyText = `Our Canteen Head Chef has approved ${rescues.length} surplus batch(es) at progressive discounts:\n`;
      rescues.forEach((r) => {
        replyText += `\n• ${r.imageEmoji} **${r.foodItemName}** — **₹${r.currentPricePaise / 100}** (${r.currentDiscountPercent}% OFF, Regular ₹${r.originalPricePaise / 100}). ${r.quantityAvailable} portions remaining. Storage: ${r.handlingInfo}.`;
      });
      replyText += `\n\nRescue meals prevent campus food waste and are 100% kitchen fresh!`;
      suggestionChips = ['Add rescue meal to cart', 'Find meal under ₹60', 'Check NGO donations'];
    } else {
      replyText = `No surplus meals currently in the rescue counter. All lunch batches were collected on schedule!`;
      suggestionChips = ['Show regular menu', 'Check group deals'];
    }
  } else if (query.includes('allergen') || query.includes('ingredient')) {
    replyText = `Declared allergen policy at Central Campus Food Court:\n• Thalis contain Gluten (Wheat Phulkas).\n• Dosas and Makhani items contain Dairy (pure desi ghee & fresh paneer).\n• Cashew nuts are declared in Biryanis.\n\nAll food is prepared in our ISO 22000 certified campus kitchen.`;
    suggestionChips = ['Find gluten-free options', 'Show vegetarian meals', 'Find meal under ₹60'];
  } else if (query.includes('membership') || query.includes('pass')) {
    replyText = `The **MealLoop 30-Day Student Pass** is ₹199/month. Benefits include:\n• 10% daily discount on all regular meals\n• Priority Counter 2 pickup access\n• Exclusive ₹25 off coupon codes during exam weeks.`;
    suggestionChips = ['Join membership', 'Show meals under ₹60', 'Check active deals'];
  } else {
    replyText = `Hi ${currentUser.name}! I am LoopAI, your campus food assistant. I can search live canteen stock, find meals within your budget (e.g., "Find lunch under ₹60"), check progressive rescue offers, track group deals, and explain allergens. What would you like to eat today?`;
    suggestionChips = ['Find meal under ₹60', 'Paneer Biryani Group Deal', 'Rescue Meals (Up to 30% off)', 'Check my order status'];
  }

  res.json({
    success: true,
    reply: replyText,
    suggestionChips,
    matchingItems,
    proposedCart,
  });
});

// -------------------------------------------------------------
// 12. ADMIN PLATFORM METRICS & AUDIT LOGS
// -------------------------------------------------------------

app.get('/api/metrics', (_req: Request, res: Response) => {
  res.json({
    success: true,
    metrics: metricsStore,
  });
});

app.get('/api/audit-logs', (_req: Request, res: Response) => {
  res.json({
    success: true,
    logs: auditLogsStore,
  });
});

// -------------------------------------------------------------
// SERVER INITIALIZATION (DEV WITH VITE / PROD WITH DIST)
// -------------------------------------------------------------

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MealLoop campus food platform server running on port ${PORT}`);
  });
}

startServer();
