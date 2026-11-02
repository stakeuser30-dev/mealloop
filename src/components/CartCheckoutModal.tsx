import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  Minus,
  Tag,
  Clock,
  ShieldCheck,
  CreditCard,
  Check,
  AlertCircle,
  Award,
  Wallet,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  User as UserIcon,
} from 'lucide-react';
import { CartItem, User, Order } from '../types';
import { getCurrentUserIdToken } from '../lib/firebase';

interface CartCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateQty: (cartItemId: string, delta: number) => void;
  onClearCart: () => void;
  currentUser: User;
  onOrderSuccess: (order: Order) => void;
  firebaseUser?: any;
  onGoogleSignIn?: () => void;
}

const PICKUP_SLOTS = [
  '12:30 PM – 12:45 PM',
  '12:45 PM – 01:00 PM',
  '01:00 PM – 01:15 PM',
  '01:15 PM – 01:30 PM',
  '01:30 PM – 01:45 PM',
  '01:45 PM – 02:00 PM',
  '07:30 PM – 08:00 PM',
  '08:00 PM – 08:30 PM',
];

export const CartCheckoutModal: React.FC<CartCheckoutModalProps> = ({
  isOpen,
  onClose,
  cartItems,
  onUpdateQty,
  onClearCart,
  currentUser,
  onOrderSuccess,
  firebaseUser,
  onGoogleSignIn,
}) => {
  const [selectedSlot, setSelectedSlot] = useState(PICKUP_SLOTS[1]);
  const [orderNotes, setOrderNotes] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [useReferralCredits, setUseReferralCredits] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusNotice, setStatusNotice] = useState('');

  // Pending order state from create-order
  const [pendingOrderInfo, setPendingOrderInfo] = useState<{
    localOrderId: string;
    orderNumber: string;
    razorpayOrderId: string;
    amountPaise: number;
    keyId: string;
    isConfigured: boolean;
    reservationExpiresAt?: string;
  } | null>(null);

  // Application-level idempotency key (stable per checkout session until cleared)
  const idempotencyKeyRef = useRef<string>(`ml-idemp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  // Reset error and status notice when cart or modal changes
  useEffect(() => {
    if (isOpen) {
      setErrorMessage('');
      setStatusNotice('');
      idempotencyKeyRef.current = `ml-idemp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Authoritative price calculations in integer paise
  let itemTotalPaise = 0;
  let membershipDiscountPaise = 0;

  cartItems.forEach((ci) => {
    const line = ci.pricePaise * ci.quantity;
    itemTotalPaise += line;
    if (currentUser.hasActiveMembership && !ci.isRescue && !ci.isGroupDeal) {
      membershipDiscountPaise += Math.round(line * 0.1);
    }
  });

  let couponDiscountPaise = 0;
  if (appliedCoupon === 'CAMPUSFIRST') couponDiscountPaise = 2000;
  else if (appliedCoupon === 'EXAMRUSH') couponDiscountPaise = Math.min(4000, Math.round(itemTotalPaise * 0.15));
  else if (appliedCoupon === 'MEALPASS') couponDiscountPaise = 2500;

  let referralDiscountPaise = 0;
  if (useReferralCredits && currentUser.referralCreditsPaise > 0) {
    referralDiscountPaise = Math.min(currentUser.referralCreditsPaise, 2500);
  }

  const totalDiscountPaise = membershipDiscountPaise + couponDiscountPaise + referralDiscountPaise;
  const taxableAmountPaise = Math.max(0, itemTotalPaise - totalDiscountPaise);
  const taxesPaise = Math.round(taxableAmountPaise * 0.05); // 5% GST
  const payableAmountPaise = Math.max(0, taxableAmountPaise + taxesPaise);

  const handleApplyCoupon = (code: string) => {
    setCouponError('');
    const c = code.trim().toUpperCase();
    if (c === 'CAMPUSFIRST') {
      if (itemTotalPaise < 5000) {
        setCouponError('Minimum order of ₹50 required for CAMPUSFIRST');
        return;
      }
      setAppliedCoupon('CAMPUSFIRST');
    } else if (c === 'EXAMRUSH') {
      if (itemTotalPaise < 6000) {
        setCouponError('Minimum order of ₹60 required for EXAMRUSH');
        return;
      }
      setAppliedCoupon('EXAMRUSH');
    } else if (c === 'MEALPASS') {
      if (!currentUser.hasActiveMembership) {
        setCouponError('Exclusively for 30-Day Student Membership holders');
        return;
      }
      if (itemTotalPaise < 4000) {
        setCouponError('Minimum order of ₹40 required for MEALPASS');
        return;
      }
      setAppliedCoupon('MEALPASS');
    } else {
      setCouponError('Invalid coupon. Try CAMPUSFIRST, EXAMRUSH, or MEALPASS.');
    }
  };

  // Helper to load Razorpay Checkout script dynamically
  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Step 1: Create Order & Stock Reservation (Server-Authoritative)
  const initiateOrder = async () => {
    setErrorMessage('');
    setStatusNotice('');
    setIsProcessingPayment(true);

    try {
      const idToken = await getCurrentUserIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          items: cartItems.map((ci) => ({
            foodItemId: ci.foodItemId,
            name: ci.name,
            pricePaise: ci.pricePaise,
            quantity: ci.quantity,
            isVeg: ci.isVeg,
            isRescue: ci.isRescue,
            rescueBatchId: ci.rescueBatchId,
            isGroupDeal: ci.isGroupDeal,
            imageEmoji: ci.imageEmoji,
          })),
          pickupSlot: selectedSlot,
          couponCode: appliedCoupon || undefined,
          useReferralCredits,
          idempotencyKey: idempotencyKeyRef.current,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setErrorMessage(data.error || 'Failed to initialize order with canteen backend');
        setIsProcessingPayment(false);
        return null;
      }

      setPendingOrderInfo({
        localOrderId: data.localOrderId,
        orderNumber: data.orderNumber,
        razorpayOrderId: data.razorpayOrderId,
        amountPaise: data.amountPaise,
        keyId: data.keyId,
        isConfigured: data.isConfigured,
        reservationExpiresAt: data.reservationExpiresAt,
      });

      return data;
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error while contacting canteen server');
      setIsProcessingPayment(false);
      return null;
    }
  };

  // Step 2: Open Standard Razorpay Checkout
  const handlePayWithRazorpay = async () => {
    const orderData = await initiateOrder();
    if (!orderData) return;

    // If Razorpay keys are not configured, display clear guidance and offer Demo Payment
    if (!orderData.isConfigured) {
      setIsProcessingPayment(false);
      setStatusNotice('Razorpay test credentials are not configured in .env. Use the clearly labelled Demo Payment button below for instant hackathon verification.');
      return;
    }

    // Load Razorpay Checkout.js
    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      setErrorMessage('Could not load Razorpay Checkout script. Check your internet connection.');
      setIsProcessingPayment(false);
      return;
    }

    const options = {
      key: orderData.keyId,
      amount: orderData.amountPaise,
      currency: 'INR',
      name: 'MealLoop Campus Canteen',
      description: `Order ${orderData.orderNumber} · SAC Counter 2 Pickup`,
      order_id: orderData.razorpayOrderId,
      prefill: {
        name: currentUser.name,
        email: currentUser.email,
        contact: currentUser.phone || '9876543210',
      },
      notes: {
        localOrderId: orderData.localOrderId,
        pickupSlot: selectedSlot,
      },
      theme: {
        color: '#22C55E',
      },
      handler: async function (response: any) {
        await verifyPaymentAndMintQR({
          localOrderId: orderData.localOrderId,
          razorpayOrderId: response.razorpay_order_id || orderData.razorpayOrderId,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
          isDemoPayment: false,
        });
      },
      modal: {
        ondismiss: function () {
          setIsProcessingPayment(false);
          setStatusNotice(
            `Checkout closed. Order ${orderData.orderNumber} is held in "Awaiting Payment" for 10 minutes. You can retry payment anytime.`
          );
        },
      },
    };

    try {
      const rzpInstance = new (window as any).Razorpay(options);
      rzpInstance.on('payment.failed', function (resp: any) {
        setIsProcessingPayment(false);
        setErrorMessage(`Payment failed: ${resp.error.description || 'Transaction declined'}`);
      });
      rzpInstance.open();
    } catch (e: any) {
      setErrorMessage('Failed to launch Razorpay popup: ' + e.message);
      setIsProcessingPayment(false);
    }
  };

  // Step 3: Verify Payment Server-Side & Mint Single-Use QR
  const verifyPaymentAndMintQR = async (payload: {
    localOrderId: string;
    razorpayOrderId: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    isDemoPayment?: boolean;
  }) => {
    setIsProcessingPayment(true);
    setErrorMessage('');

    try {
      const idToken = await getCurrentUserIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

      const res = await fetch('/api/payments/verify', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.order) {
        onClearCart();
        onClose();
        onOrderSuccess(data.order);
      } else {
        setErrorMessage(data.error || 'Payment signature verification failed');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to complete server verification');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Hackathon Demo Payment Option (Clearly Labelled, No Money Moved)
  const handleExecuteDemoPayment = async () => {
    let orderData = pendingOrderInfo;
    if (!orderData) {
      orderData = await initiateOrder();
      if (!orderData) return;
    }

    await verifyPaymentAndMintQR({
      localOrderId: orderData.localOrderId,
      razorpayOrderId: orderData.razorpayOrderId,
      razorpayPaymentId: `pay_demo_${Date.now()}`,
      isDemoPayment: true,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-xs">
      <div className="bg-[#0B1220] border-l border-slate-800 w-full max-w-lg h-full shadow-2xl flex flex-col text-slate-100">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#111B2E]">
          <div>
            <h2 className="text-base font-bold text-white">Your Campus Order</h2>
            <p className="text-xs text-slate-400">
              Pickup at Central Campus Food Court · Counter 2
            </p>
          </div>

          <div className="flex items-center gap-3">
            {cartItems.length > 0 && (
              <button
                onClick={onClearCart}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Clear Cart
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Close cart"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {cartItems.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <span className="text-4xl block" aria-hidden="true">🍱</span>
              <h3 className="text-base font-semibold text-white">Your cart is empty</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Add fresh student thalis, group deals, or rescue meals from the menu to prepare your pickup order.
              </p>
              <button
                onClick={onClose}
                className="bg-[#22C55E] hover:bg-[#1ea34d] text-[#0B1220] px-5 py-2.5 rounded-xl text-xs font-bold transition-colors"
              >
                Browse Canteen Menu
              </button>
            </div>
          ) : (
            <>
              {/* Pickup Slot Selection */}
              <div className="bg-[#111B2E] border border-slate-800 rounded-2xl p-4 space-y-2">
                <label htmlFor="pickup-slot-select" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#22C55E]" />
                  Select Pickup Time Window (Counter 2)
                </label>
                <select
                  id="pickup-slot-select"
                  value={selectedSlot}
                  onChange={(e) => setSelectedSlot(e.target.value)}
                  className="w-full bg-[#162238] border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-[#22C55E]"
                >
                  {PICKUP_SLOTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Order Notes / Special Instructions */}
              <div className="bg-[#111B2E] border border-slate-800 rounded-2xl p-4 space-y-2">
                <label htmlFor="order-notes-input" className="text-xs font-semibold text-slate-300 block">
                  Kitchen Notes (Optional)
                </label>
                <input
                  id="order-notes-input"
                  type="text"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="e.g. Extra spicy chutney, separate packaging"
                  className="w-full bg-[#162238] border border-slate-700 text-white rounded-xl px-3 py-2 text-xs placeholder-slate-500 focus:outline-none focus:border-[#22C55E]"
                />
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold uppercase tracking-wider">Order Items</span>
                  <span>{cartItems.length} item(s)</span>
                </div>

                {cartItems.map((item) => (
                  <div
                    key={item.cartItemId}
                    className="bg-[#111B2E] p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl" aria-hidden="true">{item.imageEmoji}</span>
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                          {item.name}
                          {item.isVeg && (
                            <span className="text-[10px] text-emerald-400 font-normal">· Veg</span>
                          )}
                        </h4>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {item.isRescue && (
                            <span className="text-[#FB923C] font-semibold">Rescue Deal · </span>
                          )}
                          {item.isGroupDeal && (
                            <span className="text-amber-400 font-semibold">Group Deal · </span>
                          )}
                          <span className="font-mono tabular-nums">₹{item.pricePaise / 100}</span> each
                        </div>
                      </div>
                    </div>

                    {/* Quantity Stepper */}
                    <div className="flex items-center gap-2 bg-[#162238] px-2 py-1 rounded-xl border border-slate-700">
                      <button
                        onClick={() => onUpdateQty(item.cartItemId, -1)}
                        className="p-1 text-slate-300 hover:text-white"
                        aria-label={`Decrease quantity of ${item.name}`}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-mono font-bold text-white min-w-[16px] text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQty(item.cartItemId, 1)}
                        className="p-1 text-slate-300 hover:text-white"
                        aria-label={`Increase quantity of ${item.name}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Coupons & Campus Discounts */}
              <div className="bg-[#111B2E] p-4 rounded-2xl border border-slate-800 space-y-3">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-[#22C55E]" />
                  Apply Campus Promo Code
                </span>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="Enter code (CAMPUSFIRST, EXAMRUSH)"
                    className="flex-1 bg-[#162238] border border-slate-700 text-white rounded-xl px-3 py-2 text-xs uppercase font-mono tracking-wider focus:outline-none focus:border-[#22C55E]"
                  />
                  <button
                    onClick={() => handleApplyCoupon(couponCode)}
                    className="bg-[#162238] hover:bg-[#1E2D4A] border border-slate-700 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
                  >
                    Apply
                  </button>
                </div>

                {couponError && (
                  <p className="text-[11px] text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {couponError}
                  </p>
                )}

                {appliedCoupon && (
                  <div className="flex items-center justify-between text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl">
                    <span className="font-semibold">Code {appliedCoupon} applied!</span>
                    <button
                      onClick={() => setAppliedCoupon(null)}
                      className="text-[11px] text-slate-400 hover:text-white"
                    >
                      Remove
                    </button>
                  </div>
                )}

                {/* Available Coupon Quick Tags */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {['CAMPUSFIRST', 'EXAMRUSH', 'MEALPASS'].map((code) => (
                    <button
                      key={code}
                      onClick={() => {
                        setCouponCode(code);
                        handleApplyCoupon(code);
                      }}
                      className={`text-[11px] px-2 py-1 rounded-lg border font-mono transition-colors ${
                        appliedCoupon === code
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-[#162238] text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      {code}
                    </button>
                  ))}
                </div>

                {/* Referral Credits Toggle */}
                {currentUser.referralCreditsPaise > 0 && (
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-emerald-400" />
                      <div className="text-xs">
                        <span className="font-semibold text-white block">
                          Use Referral Wallet Credits
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Balance: ₹{currentUser.referralCreditsPaise / 100}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setUseReferralCredits(!useReferralCredits)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                        useReferralCredits
                          ? 'bg-emerald-500 text-[#0B1220] border-emerald-500 font-bold'
                          : 'bg-[#162238] text-slate-300 border-slate-700 hover:text-white'
                      }`}
                    >
                      {useReferralCredits ? 'Applied (-₹25)' : 'Apply'}
                    </button>
                  </div>
                )}
              </div>

              {/* Status / Notice Messages */}
              {statusNotice && (
                <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-2xl text-xs text-amber-300 space-y-1">
                  <span className="font-semibold block flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                    Notice
                  </span>
                  <p className="text-[11px] text-amber-200/90 leading-relaxed">{statusNotice}</p>
                </div>
              )}

              {errorMessage && (
                <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-2xl text-xs text-red-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span className="text-[11px]">{errorMessage}</span>
                </div>
              )}

              {/* Authoritative Price Breakdown */}
              <div className="bg-[#111B2E] p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal</span>
                  <span className="font-mono tabular-nums text-slate-200">₹{itemTotalPaise / 100}</span>
                </div>

                {membershipDiscountPaise > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span className="flex items-center gap-1">
                      <Award className="w-3.5 h-3.5" />
                      Student Pass Savings (10%)
                    </span>
                    <span className="font-mono tabular-nums">-₹{membershipDiscountPaise / 100}</span>
                  </div>
                )}

                {couponDiscountPaise > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Coupon ({appliedCoupon})</span>
                    <span className="font-mono tabular-nums">-₹{couponDiscountPaise / 100}</span>
                  </div>
                )}

                {referralDiscountPaise > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Referral Credit</span>
                    <span className="font-mono tabular-nums">-₹{referralDiscountPaise / 100}</span>
                  </div>
                )}

                <div className="flex justify-between text-slate-400">
                  <span>GST (5%)</span>
                  <span className="font-mono tabular-nums text-slate-200">₹{taxesPaise / 100}</span>
                </div>

                <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-sm font-bold text-white">
                  <span>Payable Total</span>
                  <span className="text-lg font-mono tabular-nums text-[#22C55E]">
                    ₹{payableAmountPaise / 100}
                  </span>
                </div>
              </div>

              {/* Google Authentication Status in Checkout */}
              {firebaseUser ? (
                <div className="bg-[#111B2E] p-3 rounded-xl border border-[#22C55E]/30 flex items-center gap-2.5 text-xs">
                  {firebaseUser.photoURL ? (
                    <img
                      src={firebaseUser.photoURL}
                      alt="Avatar"
                      className="w-7 h-7 rounded-full object-cover ring-1 ring-[#22C55E]"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-[#22C55E]/20 text-[#22C55E] flex items-center justify-center font-bold text-xs">
                      {(firebaseUser.displayName || firebaseUser.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 truncate">
                    <p className="font-bold text-white leading-tight truncate">
                      {firebaseUser.displayName || firebaseUser.email}
                    </p>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      ✓ Authenticated Google Account · Order & QR saved to profile
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bg-[#111B2E] p-3 rounded-xl border border-blue-500/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white leading-tight">Checkout with Google</p>
                      <p className="text-[11px] text-slate-400">Save your pickup QR across sessions & mobile</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onGoogleSignIn}
                    className="bg-white hover:bg-slate-100 text-[#0B1220] font-bold text-xs px-3 py-1.5 rounded-lg transition-colors shrink-0 shadow-sm active:scale-95"
                  >
                    Sign In
                  </button>
                </div>
              )}

              {/* Payment Actions */}
              <div className="space-y-3 pt-2">
                {/* 1. Primary Action: Pay with Razorpay Standard Checkout */}
                <button
                  disabled={isProcessingPayment}
                  onClick={handlePayWithRazorpay}
                  className="w-full bg-[#22C55E] hover:bg-[#1ea34d] disabled:opacity-50 text-[#0B1220] py-3.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-emerald-500/20"
                >
                  {isProcessingPayment ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Connecting to Canteen Server...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      Pay ₹{payableAmountPaise / 100} via Razorpay
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </button>

                {/* 2. Clearly Labelled Hackathon Demo Payment Option */}
                <button
                  type="button"
                  disabled={isProcessingPayment}
                  onClick={handleExecuteDemoPayment}
                  className="w-full bg-[#162238] hover:bg-[#1E2D4A] disabled:opacity-50 text-slate-300 hover:text-white py-2.5 rounded-xl font-medium text-xs border border-slate-700 transition-colors flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Demo Payment — No Money Moved (Simulate Captured Test)</span>
                </button>

                {/* Security and Pickup Reassurance */}
                <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 pt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#22C55E]" />
                  <span>100% Secure · 10-Min Stock Reservation · Single-Use Pickup QR</span>
                </div>
              </div>
            </>
          )}

        </div>

      </div>
    </div>
  );
};
