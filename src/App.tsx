import React, { useState, useEffect, useCallback } from 'react';
import {
  UtensilsCrossed,
  Search,
  Users,
  ShoppingBag,
  Award,
  Sparkles,
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { StudentHome } from './components/StudentHome';
import { MealDetailModal } from './components/MealDetailModal';
import { CartCheckoutModal } from './components/CartCheckoutModal';
import { PickupQrModal } from './components/PickupQrModal';
import { StaffDashboard } from './components/StaffDashboard';
import { NgoPortal } from './components/NgoPortal';
import { AdminDashboard } from './components/AdminDashboard';
import { AIAssistantModal } from './components/AIAssistantModal';
import { StudentMembershipOrders } from './components/StudentMembershipOrders';

import {
  User,
  FoodItem,
  GroupDeal,
  RescueMealBatch,
  DonationOffer,
  Order,
  PartyPreorder,
  PlatformMetrics,
  AuditLog,
  CartItem,
} from './types';

import {
  DEMO_USERS,
  INITIAL_FOOD_ITEMS,
  INITIAL_GROUP_DEALS,
  INITIAL_RESCUE_BATCHES,
  INITIAL_DONATION_OFFERS,
  INITIAL_ORDERS,
  INITIAL_PREORDERS,
  INITIAL_METRICS,
  INITIAL_AUDIT_LOGS,
  INITIAL_COUPONS,
} from './data/mockData';
import {
  auth,
  signInWithGoogle,
  checkRedirectLoginResult,
  logOut,
  testFirestoreConnection,
} from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

export default function App() {
  // Current Active Persona & Role
  const [activeRole, setActiveRole] = useState<'student' | 'staff' | 'admin' | 'ngo'>('student');
  const [currentUser, setCurrentUser] = useState<User>(DEMO_USERS.student);
  const [activeTab, setActiveTab] = useState<string>('menu');

  // Real Firebase Google Authentication State
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Core Data Stores
  const [foodItems, setFoodItems] = useState<FoodItem[]>(INITIAL_FOOD_ITEMS);
  const [groupDeals, setGroupDeals] = useState<GroupDeal[]>(INITIAL_GROUP_DEALS);
  const [rescueBatches, setRescueBatches] = useState<RescueMealBatch[]>(INITIAL_RESCUE_BATCHES);
  const [donationOffers, setDonationOffers] = useState<DonationOffer[]>(INITIAL_DONATION_OFFERS);
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [preorders, setPreorders] = useState<PartyPreorder[]>(INITIAL_PREORDERS);
  const [metrics, setMetrics] = useState<PlatformMetrics>(INITIAL_METRICS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);

  // Cart State (Integer Paise)
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [demoClockOffsetHours, setDemoClockOffsetHours] = useState(0);

  // Modals
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [selectedMealDetail, setSelectedMealDetail] = useState<FoodItem | null>(null);
  const [activeQrOrder, setActiveQrOrder] = useState<Order | null>(null);

  // Fetch initial data from backend API
  const refreshBackendData = useCallback(async () => {
    try {
      const [uRes, fRes, gRes, rRes, dRes, oRes, pRes, mRes, lRes] = await Promise.allSettled([
        fetch('/api/auth/me').then((r) => r.json()),
        fetch('/api/food-items').then((r) => r.json()),
        fetch('/api/group-deals').then((r) => r.json()),
        fetch('/api/rescue-batches').then((r) => r.json()),
        fetch('/api/donations').then((r) => r.json()),
        fetch('/api/orders').then((r) => r.json()),
        fetch('/api/preorders').then((r) => r.json()),
        fetch('/api/metrics').then((r) => r.json()),
        fetch('/api/audit-logs').then((r) => r.json()),
      ]);

      if (uRes.status === 'fulfilled' && uRes.value.success) {
        setCurrentUser(uRes.value.user);
        setActiveRole(uRes.value.activeRole || 'student');
      }
      if (fRes.status === 'fulfilled' && fRes.value.success) {
        setFoodItems(fRes.value.foodItems);
      }
      if (gRes.status === 'fulfilled' && gRes.value.success) {
        setGroupDeals(gRes.value.groupDeals);
      }
      if (rRes.status === 'fulfilled' && rRes.value.success) {
        setRescueBatches(rRes.value.rescueBatches);
        setDemoClockOffsetHours(rRes.value.demoClockOffsetHours || 0);
      }
      if (dRes.status === 'fulfilled' && dRes.value.success) {
        setDonationOffers(dRes.value.donations);
      }
      if (oRes.status === 'fulfilled' && oRes.value.success) {
        setOrders(oRes.value.orders);
      }
      if (pRes.status === 'fulfilled' && pRes.value.success) {
        setPreorders(pRes.value.preorders);
      }
      if (mRes.status === 'fulfilled' && mRes.value.success) {
        setMetrics(mRes.value.metrics);
      }
      if (lRes.status === 'fulfilled' && lRes.value.success) {
        setAuditLogs(lRes.value.logs);
      }
    } catch (e) {
      console.warn('API sync fallback', e);
    }
  }, []);

  // Sync authenticated Firebase user with backend session
  const handleSyncFirebaseUser = useCallback(async (user: FirebaseUser) => {
    try {
      setIsAuthLoading(true);
      setAuthError(null);
      const idToken = await user.getIdToken();
      const res = await fetch('/api/auth/verify-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
        setActiveRole(data.user.role?.toLowerCase() || 'student');
      }
    } catch (err: any) {
      console.error('Error synchronizing Google user with backend:', err);
      setAuthError(err.message || 'Failed to authenticate user profile');
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshBackendData();

    // Test Firestore connection on boot per Firebase guidelines
    testFirestoreConnection();

    // Check redirect sign-in results if returning from full-page redirect
    checkRedirectLoginResult()
      .then((user) => {
        if (user) {
          setFirebaseUser(user);
          handleSyncFirebaseUser(user);
        }
      })
      .catch((err) => {
        setAuthError(err.message);
      });

    // Listen to Firebase auth changes if auth is initialized
    let unsubscribe = () => {};
    if (auth) {
      try {
        unsubscribe = onAuthStateChanged(auth, async (user) => {
          setFirebaseUser(user);
          if (user) {
            await handleSyncFirebaseUser(user);
          }
        });
      } catch (authErr) {
        console.warn('Auth listener registration note:', authErr);
      }
    }

    return () => unsubscribe();
  }, [refreshBackendData, handleSyncFirebaseUser]);

  // Google Sign-In Action
  const handleGoogleSignIn = async () => {
    try {
      setIsAuthLoading(true);
      setAuthError(null);
      const user = await signInWithGoogle();
      if (user) {
        setFirebaseUser(user);
        await handleSyncFirebaseUser(user);
      }
    } catch (err: any) {
      console.error('Google sign in error:', err);
      setAuthError(err.message || 'Google Sign-in failed. Please retry.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Google Sign-Out Action
  const handleGoogleSignOut = async () => {
    try {
      setIsAuthLoading(true);
      await logOut();
      setFirebaseUser(null);
      await fetch('/api/auth/logout', { method: 'POST' });
      setCurrentUser(DEMO_USERS.student);
      setActiveRole('student');
    } catch (err: any) {
      console.error('Logout error:', err);
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Switch Role
  const handleSwitchRole = async (role: 'student' | 'staff' | 'admin' | 'ngo') => {
    try {
      const res = await fetch('/api/auth/switch-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveRole(role);
        setCurrentUser(data.user);
        if (role === 'student') setActiveTab('menu');
        else if (role === 'staff') setActiveTab('staff-queue');
        else if (role === 'admin') setActiveTab('admin-metrics');
        else if (role === 'ngo') setActiveTab('ngo-offers');
        refreshBackendData();
      }
    } catch {
      setActiveRole(role);
      setCurrentUser(DEMO_USERS[role]);
    }
  };

  // Demo Clock Controls
  const handleAdvanceClock = async (hours: number) => {
    try {
      const res = await fetch('/api/demo-clock/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addHours: hours }),
      });
      const data = await res.json();
      if (data.success) {
        setDemoClockOffsetHours(data.demoClockOffsetHours);
        setRescueBatches(data.rescueBatches);
        refreshBackendData();
      }
    } catch {
      setDemoClockOffsetHours((prev) => prev + hours);
    }
  };

  const handleResetClock = async () => {
    try {
      const res = await fetch('/api/demo-clock/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true }),
      });
      const data = await res.json();
      if (data.success) {
        setDemoClockOffsetHours(0);
        setRescueBatches(data.rescueBatches);
        refreshBackendData();
      }
    } catch {
      setDemoClockOffsetHours(0);
    }
  };

  // Cart Operations
  const handleAddToCart = (item: FoodItem, customOptions?: any[]) => {
    const customSig = customOptions ? customOptions.map((o) => o.optionName).join('-') : 'std';
    const cartItemId = `${item.id}-${customSig}`;

    let finalPricePaise = item.pricePaise;
    if (customOptions) {
      customOptions.forEach((o) => {
        finalPricePaise += o.pricePaise;
      });
    }

    setCartItems((prev) => {
      const existing = prev.find((ci) => ci.cartItemId === cartItemId);
      if (existing) {
        return prev.map((ci) =>
          ci.cartItemId === cartItemId ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      } else {
        return [
          ...prev,
          {
            cartItemId,
            foodItemId: item.id,
            name: item.name,
            pricePaise: finalPricePaise,
            quantity: 1,
            isVeg: item.isVeg,
            selectedOptions: customOptions,
            imageEmoji: item.imageEmoji,
          },
        ];
      }
    });
  };

  const handleAddRescueToCart = (batch: RescueMealBatch) => {
    const cartItemId = `rescue-${batch.id}`;
    setCartItems((prev) => {
      const existing = prev.find((ci) => ci.cartItemId === cartItemId);
      if (existing) {
        return prev.map((ci) =>
          ci.cartItemId === cartItemId ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      } else {
        return [
          ...prev,
          {
            cartItemId,
            foodItemId: batch.foodItemId,
            name: `${batch.foodItemName} (Rescue Meal - ${batch.currentDiscountPercent}% Off)`,
            pricePaise: batch.currentPricePaise,
            quantity: 1,
            isVeg: true,
            isRescue: true,
            rescueBatchId: batch.id,
            imageEmoji: batch.imageEmoji,
          },
        ];
      }
    });
    setIsCartOpen(true);
  };

  const handleUpdateCartQty = (cartItemId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((ci) => {
          if (ci.cartItemId === cartItemId) {
            const next = ci.quantity + delta;
            return next > 0 ? { ...ci, quantity: next } : null;
          }
          return ci;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  // Group Deal Join
  const handleJoinGroupDeal = async (dealId: string) => {
    const res = await fetch(`/api/group-deals/${dealId}/join`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      setGroupDeals((prev) => prev.map((d) => (d.id === dealId ? data.groupDeal : d)));
      refreshBackendData();
    } else {
      alert(data.error || 'Could not join deal');
    }
  };

  const handleSimulatePeerJoin = async (dealId: string) => {
    const res = await fetch(`/api/group-deals/${dealId}/simulate-peer`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      setGroupDeals((prev) => prev.map((d) => (d.id === dealId ? data.groupDeal : d)));
      refreshBackendData();
    }
  };

  // Staff QR Scan Handover
  const handleScanPickupToken = async (token: string) => {
    const res = await fetch('/api/pickup/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manualToken: token }),
    });
    const data = await res.json();
    refreshBackendData();
    return data;
  };

  // Staff Approve Rescue Batch
  const handleApproveRescue = async (foodItemId: string, quantity: number, reason: string, handlingInfo: string) => {
    const res = await fetch('/api/rescue-batches/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foodItemId, quantity, reason, handlingInfo }),
    });
    const data = await res.json();
    if (data.success) {
      refreshBackendData();
      alert('Surplus batch approved for progressive rescue discount!');
    }
  };

  // Staff Quote Preorder
  const handleQuotePreorder = async (preorderId: string, quotePaise: number, remarks: string) => {
    const res = await fetch(`/api/preorders/${preorderId}/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quotedPricePaise: quotePaise, canteenRemarks: remarks }),
    });
    const data = await res.json();
    if (data.success) {
      refreshBackendData();
    }
  };

  // Staff Update Stock
  const handleUpdateStock = async (foodItemId: string, newStock: number) => {
    const res = await fetch(`/api/food-items/${foodItemId}/stock`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stockAvailable: newStock }),
    });
    const data = await res.json();
    if (data.success) {
      setFoodItems((prev) => prev.map((f) => (f.id === foodItemId ? data.foodItem : f)));
    }
  };

  // NGO Actions
  const handleAcceptDonation = async (id: string) => {
    const res = await fetch(`/api/donations/${id}/accept`, { method: 'POST' });
    const data = await res.json();
    if (data.success) refreshBackendData();
  };

  const handleDeclineDonation = async (id: string) => {
    const res = await fetch(`/api/donations/${id}/decline`, { method: 'POST' });
    const data = await res.json();
    if (data.success) refreshBackendData();
  };

  const handleConfirmDonationHandover = async (id: string) => {
    const res = await fetch(`/api/donations/${id}/handover`, { method: 'POST' });
    const data = await res.json();
    if (data.success) refreshBackendData();
  };

  // Student Membership
  const handlePurchaseMembership = async () => {
    const res = await fetch('/api/membership/purchase', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      setCurrentUser(data.user);
      refreshBackendData();
      alert('30-Day Student Membership activated!');
    }
  };

  // Student Party Preorder Submit
  const handleSubmitPreorder = async (formData: any) => {
    const res = await fetch('/api/preorders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    const data = await res.json();
    if (data.success) refreshBackendData();
  };

  // Cart total in paise
  const cartItemCount = cartItems.reduce((acc, curr) => acc + curr.quantity, 0);
  const cartTotalPaise = cartItems.reduce((acc, curr) => acc + curr.pricePaise * curr.quantity, 0);

  return (
    <div className="min-h-screen flex flex-col bg-[#0B1220] text-slate-100 font-sans selection:bg-[#22C55E]/30 selection:text-white">
      
      {/* Universal Campus Navbar */}
      <Navbar
        currentUser={currentUser}
        activeRole={activeRole}
        onSwitchRole={handleSwitchRole}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        cartItemCount={cartItemCount}
        cartTotalPaise={cartTotalPaise}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenAI={() => {
          setAiPrompt('');
          setIsAIOpen(true);
        }}
        onOpenQR={() => {
          if (orders.length > 0) {
            setActiveQrOrder(orders[0]);
          } else {
            setActiveTab('orders');
          }
        }}
        demoClockOffsetHours={demoClockOffsetHours}
        onAdvanceClock={handleAdvanceClock}
        onResetClock={handleResetClock}
        firebaseUser={firebaseUser}
        onGoogleSignIn={handleGoogleSignIn}
        onGoogleSignOut={handleGoogleSignOut}
        isAuthLoading={isAuthLoading}
        authError={authError}
      />

      {/* Main Viewport */}
      <main className="flex-1 pb-16">
        
        {/* STUDENT VIEWS */}
        {activeRole === 'student' && (
          <>
            {activeTab === 'menu' && (
              <StudentHome
                currentUser={currentUser}
                foodItems={foodItems}
                groupDeals={groupDeals}
                rescueBatches={rescueBatches}
                cartItems={cartItems}
                onAddToCart={handleAddToCart}
                onAddRescueToCart={handleAddRescueToCart}
                onJoinGroupDeal={handleJoinGroupDeal}
                onSimulatePeerJoin={handleSimulatePeerJoin}
                onSelectFoodDetail={(item) => setSelectedMealDetail(item)}
                onOpenAIWithPrompt={(prompt) => {
                  setAiPrompt(prompt);
                  setIsAIOpen(true);
                }}
                demoClockOffsetHours={demoClockOffsetHours}
                onAdvanceClock={handleAdvanceClock}
              />
            )}

            {activeTab === 'group-deals' && (
              <div className="pt-4">
                <StudentHome
                  currentUser={currentUser}
                  foodItems={foodItems}
                  groupDeals={groupDeals}
                  rescueBatches={rescueBatches}
                  cartItems={cartItems}
                  onAddToCart={handleAddToCart}
                  onAddRescueToCart={handleAddRescueToCart}
                  onJoinGroupDeal={handleJoinGroupDeal}
                  onSimulatePeerJoin={handleSimulatePeerJoin}
                  onSelectFoodDetail={(item) => setSelectedMealDetail(item)}
                  onOpenAIWithPrompt={(prompt) => {
                    setAiPrompt(prompt);
                    setIsAIOpen(true);
                  }}
                  demoClockOffsetHours={demoClockOffsetHours}
                  onAdvanceClock={handleAdvanceClock}
                />
              </div>
            )}

            {activeTab === 'rescue' && (
              <div className="pt-4">
                <StudentHome
                  currentUser={currentUser}
                  foodItems={foodItems}
                  groupDeals={groupDeals}
                  rescueBatches={rescueBatches}
                  cartItems={cartItems}
                  onAddToCart={handleAddToCart}
                  onAddRescueToCart={handleAddRescueToCart}
                  onJoinGroupDeal={handleJoinGroupDeal}
                  onSimulatePeerJoin={handleSimulatePeerJoin}
                  onSelectFoodDetail={(item) => setSelectedMealDetail(item)}
                  onOpenAIWithPrompt={(prompt) => {
                    setAiPrompt(prompt);
                    setIsAIOpen(true);
                  }}
                  demoClockOffsetHours={demoClockOffsetHours}
                  onAdvanceClock={handleAdvanceClock}
                />
              </div>
            )}

            {activeTab === 'membership' && (
              <StudentMembershipOrders
                currentUser={currentUser}
                orders={orders}
                preorders={preorders}
                onOpenQR={(ord) => setActiveQrOrder(ord)}
                onPurchaseMembership={handlePurchaseMembership}
                onSubmitPreorder={handleSubmitPreorder}
                defaultSubTab="membership"
              />
            )}

            {activeTab === 'orders' && (
              <StudentMembershipOrders
                currentUser={currentUser}
                orders={orders}
                preorders={preorders}
                onOpenQR={(ord) => setActiveQrOrder(ord)}
                onPurchaseMembership={handlePurchaseMembership}
                onSubmitPreorder={handleSubmitPreorder}
                defaultSubTab="orders"
              />
            )}
          </>
        )}

        {/* CANTEEN STAFF VIEWS */}
        {activeRole === 'staff' && (
          <StaffDashboard
            orders={orders}
            rescueBatches={rescueBatches}
            foodItems={foodItems}
            preorders={preorders}
            onScanToken={handleScanPickupToken}
            onApproveRescueBatch={handleApproveRescue}
            onQuotePreorder={handleQuotePreorder}
            onUpdateStock={handleUpdateStock}
          />
        )}

        {/* NGO PARTNER VIEWS */}
        {activeRole === 'ngo' && (
          <NgoPortal
            donations={donationOffers}
            onAcceptOffer={handleAcceptDonation}
            onDeclineOffer={handleDeclineDonation}
            onConfirmHandover={handleConfirmDonationHandover}
          />
        )}

        {/* ADMIN VIEWS */}
        {activeRole === 'admin' && (
          <AdminDashboard
            metrics={metrics}
            auditLogs={auditLogs}
            coupons={INITIAL_COUPONS}
          />
        )}

      </main>

      {/* Floating LoopAI Assistant Trigger (Non-intrusive placement) */}
      <button
        onClick={() => {
          setAiPrompt('');
          setIsAIOpen(true);
        }}
        className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-30 bg-[#22C55E] hover:bg-[#1ea34d] text-[#0B1220] px-3.5 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 font-bold text-xs transition-transform hover:scale-105 active:scale-95"
        aria-label="Open LoopAI food assistant"
      >
        <Sparkles className="w-4 h-4" />
        <span className="hidden sm:inline">Ask LoopAI</span>
      </button>

      {/* Mobile Bottom Navigation Bar */}
      {activeRole === 'student' && (
        <nav
          aria-label="Mobile Navigation"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0B1220]/95 backdrop-blur-md border-t border-slate-800 px-2 py-2 flex items-center justify-around text-[10px] text-slate-400"
        >
          <button
            onClick={() => setActiveTab('menu')}
            className={`flex flex-col items-center gap-1 p-1 min-w-[50px] transition-colors ${
              activeTab === 'menu' ? 'text-[#22C55E] font-bold' : 'hover:text-white'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4" />
            <span>Home</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('menu');
            }}
            className="flex flex-col items-center gap-1 p-1 min-w-[50px] hover:text-white transition-colors"
          >
            <Search className="w-4 h-4" />
            <span>Search</span>
          </button>

          <button
            onClick={() => setActiveTab('group-deals')}
            className={`flex flex-col items-center gap-1 p-1 min-w-[50px] transition-colors ${
              activeTab === 'group-deals' ? 'text-[#22C55E] font-bold' : 'hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Group Deals</span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`flex flex-col items-center gap-1 p-1 min-w-[50px] transition-colors relative ${
              activeTab === 'orders' ? 'text-[#22C55E] font-bold' : 'hover:text-white'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Orders</span>
            {orders.filter((o) => o.collectionStatus !== 'COLLECTED' && o.collectionStatus !== 'CANCELLED').length > 0 && (
              <span className="absolute top-0 right-2 w-2 h-2 rounded-full bg-[#22C55E]" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('membership')}
            className={`flex flex-col items-center gap-1 p-1 min-w-[50px] transition-colors ${
              activeTab === 'membership' ? 'text-[#22C55E] font-bold' : 'hover:text-white'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Profile</span>
          </button>
        </nav>
      )}

      {/* Footer */}
      <footer className="bg-[#070C16] border-t border-slate-800 text-slate-400 py-10 pb-24 md:pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#22C55E] flex items-center justify-center font-black text-[#0B1220]">
                ML
              </div>
              <span className="text-lg font-black text-white">MealLoop</span>
              <span className="text-xs text-slate-500">· Campus Canteen Food Ordering & QR Pickup Platform</span>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold">
              <button onClick={() => handleSwitchRole('student')} className="hover:text-white">Student View</button>
              <button onClick={() => handleSwitchRole('staff')} className="hover:text-white">Staff Scanner</button>
              <button onClick={() => handleSwitchRole('admin')} className="hover:text-white">Admin Audit</button>
              <button onClick={() => handleSwitchRole('ngo')} className="hover:text-white">NGO Recovery</button>
            </div>
          </div>

          <div className="text-center text-[11px] text-slate-500 border-t border-slate-800/80 pt-6">
            Designed for Campus Central Canteens. Realized savings calculated in integer paise. All QR redemptions protected with atomic server-side single-use locks.
          </div>
        </div>
      </footer>

      {/* MODALS */}
      <CartCheckoutModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateQty={handleUpdateCartQty}
        onClearCart={() => setCartItems([])}
        currentUser={currentUser}
        firebaseUser={firebaseUser}
        onGoogleSignIn={handleGoogleSignIn}
        onOrderSuccess={(newOrder) => {
          setActiveQrOrder(newOrder);
          refreshBackendData();
        }}
      />

      <PickupQrModal
        order={activeQrOrder}
        isOpen={!!activeQrOrder}
        onClose={() => setActiveQrOrder(null)}
      />

      <MealDetailModal
        item={selectedMealDetail}
        isOpen={!!selectedMealDetail}
        onClose={() => setSelectedMealDetail(null)}
        onAddToCart={handleAddToCart}
      />

      <AIAssistantModal
        isOpen={isAIOpen}
        onClose={() => setIsAIOpen(false)}
        onAddToCart={(item) => {
          handleAddToCart(item);
          setIsCartOpen(true);
        }}
        initialPrompt={aiPrompt}
      />

    </div>
  );
}
