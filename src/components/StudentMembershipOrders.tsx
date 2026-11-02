import React, { useState } from 'react';
import {
  Award,
  QrCode,
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Phone,
  Plus,
} from 'lucide-react';
import { User, Order, PartyPreorder } from '../types';

interface StudentMembershipOrdersProps {
  currentUser: User;
  orders: Order[];
  preorders: PartyPreorder[];
  onOpenQR: (order: Order) => void;
  onPurchaseMembership: () => Promise<void>;
  onSubmitPreorder: (data: {
    eventTitle: string;
    eventDate: string;
    pickupTime: string;
    headCount: number;
    itemsRequested: { name: string; quantity: number }[];
    specialInstructions: string;
    contactPhone: string;
  }) => Promise<void>;
  defaultSubTab?: 'membership' | 'orders' | 'preorders';
}

export const StudentMembershipOrders: React.FC<StudentMembershipOrdersProps> = ({
  currentUser,
  orders,
  preorders,
  onOpenQR,
  onPurchaseMembership,
  onSubmitPreorder,
  defaultSubTab = 'orders',
}) => {
  const [subTab, setSubTab] = useState<'membership' | 'orders' | 'preorders'>(defaultSubTab);
  const [isBuying, setIsBuying] = useState(false);

  // Preorder form state
  const [eventTitle, setEventTitle] = useState('Wing 3 Birthday Party');
  const [eventDate, setEventDate] = useState('2026-11-10');
  const [pickupTime, setPickupTime] = useState('08:00 PM');
  const [headCount, setHeadCount] = useState(12);
  const [specialInstructions, setSpecialInstructions] = useState('Provide disposable plates and extra napkins');
  const [contactPhone, setContactPhone] = useState(currentUser.phone || '+91 98765 43210');
  const [isSubmittingPreorder, setIsSubmittingPreorder] = useState(false);
  const [showPreorderSuccess, setShowPreorderSuccess] = useState(false);

  const handleBuyPass = async () => {
    setIsBuying(true);
    try {
      await onPurchaseMembership();
    } finally {
      setIsBuying(false);
    }
  };

  const handlePreorderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingPreorder(true);
    try {
      await onSubmitPreorder({
        eventTitle,
        eventDate,
        pickupTime,
        headCount,
        itemsRequested: [
          { name: 'Paneer Makhani Biryani Bowl', quantity: headCount },
          { name: 'Cardamom Cutting Chai Flask', quantity: Math.ceil(headCount / 3) },
        ],
        specialInstructions,
        contactPhone,
      });
      setShowPreorderSuccess(true);
      setTimeout(() => setShowPreorderSuccess(false), 4000);
    } finally {
      setIsSubmittingPreorder(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Tab Switcher */}
      <div className="flex border-b border-slate-800 gap-4 text-xs font-bold">
        <button
          onClick={() => setSubTab('orders')}
          className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${
            subTab === 'orders'
              ? 'border-[#22C55E] text-[#22C55E]'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <QrCode className="w-4 h-4" />
          My Pickup QRs ({orders.length})
        </button>

        <button
          onClick={() => setSubTab('membership')}
          className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${
            subTab === 'membership'
              ? 'border-[#22C55E] text-[#22C55E]'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Award className="w-4 h-4" />
          30-Day Student Pass
        </button>

        <button
          onClick={() => setSubTab('preorders')}
          className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${
            subTab === 'preorders'
              ? 'border-[#22C55E] text-[#22C55E]'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          Birthday / Party Preorders
        </button>
      </div>

      {/* ORDERS / PICKUP QRs */}
      {subTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-white">Your Orders & Pickup Tokens</h2>
            <span className="text-xs text-slate-400">Present QR at Counter 2 for collection</span>
          </div>

          {orders.length === 0 ? (
            <div className="bg-[#111B2E] rounded-3xl p-12 text-center border border-slate-800 space-y-2">
              <QrCode className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-white">No Orders Placed Yet</h3>
              <p className="text-xs text-slate-400">
                Place your first campus meal order to receive a cryptographically verified pickup QR.
              </p>
            </div>
          ) : (
            orders.map((ord) => {
              const isCollected = ord.collectionStatus === 'COLLECTED';
              const isCancelled = ord.collectionStatus === 'CANCELLED' || ord.paymentStatus === 'CANCELLED';
              const isAwaitingPayment = ord.paymentStatus === 'AWAITING_PAYMENT';
              const isRefundPending = ord.paymentStatus === 'REFUND_PENDING';
              const isRefunded = ord.paymentStatus === 'REFUNDED';
              const canCancel = !isCollected && !isCancelled;

              const handleCancelOrder = async (orderId: string) => {
                if (!window.confirm('Cancel this order? Any reserved canteen stock will be released back to inventory.')) return;
                try {
                  const res = await fetch(`/api/orders/${orderId}/cancel`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reason: 'Student requested cancellation' }),
                  });
                  const data = await res.json();
                  if (data.success) {
                    alert(data.message);
                    window.location.reload();
                  } else {
                    alert(data.error || 'Failed to cancel order');
                  }
                } catch (e: any) {
                  alert(e.message || 'Error communicating with canteen server');
                }
              };

              return (
                <div
                  key={ord.id}
                  className={`bg-[#111B2E] rounded-3xl p-5 border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isCollected
                      ? 'border-slate-800 opacity-90'
                      : isCancelled
                      ? 'border-red-900/40 bg-red-950/10'
                      : 'border-[#22C55E]/40 shadow-lg shadow-green-500/5'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-white text-base">
                        #{ord.orderNumber}
                      </span>

                      {/* Status Badges */}
                      {isCollected && (
                        <span className="text-xs font-semibold text-emerald-400">· Collected</span>
                      )}
                      {isCancelled && (
                        <span className="text-xs font-semibold text-red-400">· Cancelled</span>
                      )}
                      {isAwaitingPayment && (
                        <span className="text-xs font-semibold text-amber-400">· Awaiting Payment (Stock Held)</span>
                      )}
                      {isRefundPending && (
                        <span className="text-xs font-semibold text-amber-400">· Refund Pending</span>
                      )}
                      {isRefunded && (
                        <span className="text-xs font-semibold text-slate-400">· Refunded</span>
                      )}
                      {!isCollected && !isCancelled && !isAwaitingPayment && (
                        <span className="text-xs font-semibold text-emerald-400">· Ready for Pickup</span>
                      )}

                      <span className="text-xs text-slate-400">· Slot: {ord.pickupSlot}</span>
                    </div>

                    <div className="text-xs text-slate-300">
                      {ord.items.map((i) => `${i.name} (x${i.quantity})`).join(', ')}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                      <span>{ord.canteenName} (Counter 2)</span>
                      {ord.pickupToken && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-amber-400 font-semibold">
                            Token: {ord.pickupToken}
                          </span>
                        </>
                      )}
                      {ord.cancellationReason && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-red-400 italic">Note: {ord.cancellationReason}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="font-mono font-bold text-white block">
                        ₹{ord.payableAmountPaise / 100}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {ord.isDemoPayment ? 'Demo Payment' : ord.paymentStatus === 'PAID' ? 'Paid via Razorpay' : ord.paymentStatus}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {ord.pickupQrUrl && !isCancelled && (
                        <button
                          onClick={() => onOpenQR(ord)}
                          className="bg-[#22C55E] hover:bg-[#1ea34d] text-[#0B1220] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                        >
                          <QrCode className="w-4 h-4" />
                          <span>{isCollected ? 'View Pass' : 'Show Pickup QR'}</span>
                        </button>
                      )}

                      {canCancel && (
                        <button
                          onClick={() => handleCancelOrder(ord.id)}
                          className="text-xs text-red-400 hover:text-red-300 border border-red-500/30 px-3 py-2 rounded-xl transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 30-DAY MEMBERSHIP PASS */}
      {subTab === 'membership' && (
        <div className="bg-[#111B2E] rounded-3xl p-6 sm:p-8 border border-slate-800 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
                <Award className="w-4 h-4" />
                MealLoop Campus Pass (30 Days)
              </div>
              <h2 className="text-2xl font-black text-white">Save 10% on Every Meal</h2>
              <p className="text-xs text-slate-400 max-w-xl">
                A manually renewed 30-day student dining pass for ₹199/month. Direct savings on everyday thalis, quick bites, and priority pickup counter access.
              </p>
            </div>

            <div className="text-right">
              <span className="text-3xl font-black text-white font-mono block">₹199</span>
              <span className="text-xs text-slate-400 block">per 30-day term (manual renewal)</span>
            </div>
          </div>

          {/* Active Status Box */}
          {currentUser.hasActiveMembership ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-black uppercase text-emerald-400 block tracking-wider">
                  ACTIVE STUDENT PASS HOLDER
                </span>
                <span className="text-xs text-white">
                  Valid until: <strong>Nov 28, 2026</strong>
                </span>
                <span className="text-[11px] text-slate-400 block">
                  Total Realized Savings to Date: <strong className="text-emerald-400">₹{currentUser.membershipSavingsPaise / 100}</strong>
                </span>
              </div>

              <span className="bg-emerald-500 text-[#0B1220] font-black text-xs px-3 py-1 rounded-xl uppercase">
                Active & Verified
              </span>
            </div>
          ) : (
            <button
              onClick={handleBuyPass}
              disabled={isBuying}
              className="w-full bg-[#22C55E] hover:bg-green-600 text-[#0B1220] py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-transform active:scale-95 disabled:opacity-50"
            >
              {isBuying ? 'Processing...' : 'Subscribe to 30-Day Campus Pass for ₹199 →'}
            </button>
          )}

          {/* Benefits Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="bg-[#162238] p-4 rounded-2xl border border-slate-700/80 space-y-1">
              <span className="text-xs font-bold text-white block">10% Everyday Discount</span>
              <p className="text-xs text-slate-400">Automatic 10% reduction applied across all regular canteen menu items at checkout.</p>
            </div>
            <div className="bg-[#162238] p-4 rounded-2xl border border-slate-700/80 space-y-1">
              <span className="text-xs font-bold text-white block">Priority Counter 2 Access</span>
              <p className="text-xs text-slate-400">Skip standard queue lines during 12:30 PM & 01:30 PM peak campus lunch rushes.</p>
            </div>
            <div className="bg-[#162238] p-4 rounded-2xl border border-slate-700/80 space-y-1">
              <span className="text-xs font-bold text-white block">Exam Week Coupons</span>
              <p className="text-xs text-slate-400">Exclusive access to code MEALPASS for extra savings during midterm & finals weeks.</p>
            </div>
          </div>
        </div>
      )}

      {/* PARTY & BIRTHDAY PREORDERS */}
      {subTab === 'preorders' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Submit Preorder Form */}
          <div className="bg-[#111B2E] rounded-3xl p-6 border border-slate-800 space-y-4">
            <div>
              <h3 className="text-base font-black text-white">Preorder for Hostel Celebration</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Hostel birthdays, club orientations, or project group feasts. Handled directly by Canteen kitchen staff.
              </p>
            </div>

            {showPreorderSuccess && (
              <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 p-3 rounded-xl text-xs font-bold">
                Preorder submitted! Canteen team will review and provide quotation shortly.
              </div>
            )}

            <form onSubmit={handlePreorderSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Occasion / Event Title</label>
                <input
                  type="text"
                  required
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full bg-[#162238] border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Event Date</label>
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full bg-[#162238] border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Pickup Time</label>
                  <input
                    type="text"
                    required
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                    className="w-full bg-[#162238] border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Estimated Headcount</label>
                  <input
                    type="number"
                    min="5"
                    max="100"
                    value={headCount}
                    onChange={(e) => setHeadCount(parseInt(e.target.value) || 5)}
                    className="w-full bg-[#162238] border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Student Contact Phone</label>
                  <input
                    type="text"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full bg-[#162238] border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Packaging & Serving Notes</label>
                <input
                  type="text"
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  className="w-full bg-[#162238] border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingPreorder}
                className="w-full bg-[#22C55E] hover:bg-green-600 text-[#0B1220] py-2.5 rounded-xl text-xs font-black uppercase tracking-wider"
              >
                {isSubmittingPreorder ? 'Submitting...' : 'Submit Preorder Request →'}
              </button>
            </form>
          </div>

          {/* Past/Existing Preorders List */}
          <div className="space-y-4">
            <h3 className="text-base font-black text-white">Your Celebration Preorders</h3>
            <div className="space-y-3">
              {preorders.map((po) => (
                <div key={po.id} className="bg-[#111B2E] p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-white text-sm">{po.eventTitle}</h4>
                      <span className="text-slate-400">{po.headCount} Guests · {po.eventDate} ({po.pickupTime})</span>
                    </div>
                    <span className="bg-slate-800 text-amber-300 px-2.5 py-0.5 rounded font-mono font-bold">
                      {po.status}
                    </span>
                  </div>

                  {po.quotedPricePaise && (
                    <div className="flex justify-between items-center bg-[#162238] p-2.5 rounded-xl border border-slate-700">
                      <span>Canteen Quoted Amount:</span>
                      <span className="font-mono text-[#22C55E] font-black text-sm">
                        ₹{po.quotedPricePaise / 100}
                      </span>
                    </div>
                  )}

                  {po.canteenRemarks && (
                    <p className="text-[11px] text-slate-400 italic">
                      Remarks: {po.canteenRemarks}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
