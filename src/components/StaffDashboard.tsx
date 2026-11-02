import React, { useState } from 'react';
import {
  QrCode,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Search,
  Plus,
  Package,
  Sparkles,
  Users,
  Check,
  X,
  Camera,
  RefreshCw,
} from 'lucide-react';
import { Order, RescueMealBatch, FoodItem, PartyPreorder } from '../types';

interface StaffDashboardProps {
  orders: Order[];
  rescueBatches: RescueMealBatch[];
  foodItems: FoodItem[];
  preorders: PartyPreorder[];
  onScanToken: (token: string) => Promise<{ success: boolean; message?: string; error?: string; isDuplicate?: boolean; order?: Order }>;
  onApproveRescueBatch: (foodItemId: string, quantity: number, reason: string, handlingInfo: string) => Promise<void>;
  onQuotePreorder: (preorderId: string, quotePaise: number, remarks: string) => Promise<void>;
  onUpdateStock: (foodItemId: string, newStock: number) => Promise<void>;
}

export const StaffDashboard: React.FC<StaffDashboardProps> = ({
  orders,
  rescueBatches,
  foodItems,
  preorders,
  onScanToken,
  onApproveRescueBatch,
  onQuotePreorder,
  onUpdateStock,
}) => {
  const [activeTab, setActiveTab] = useState<'scanner' | 'queue' | 'rescue' | 'preorders' | 'stock'>('scanner');
  
  // Scanner state
  const [tokenInput, setTokenInput] = useState('');
  const [scanResult, setScanResult] = useState<{
    success?: boolean;
    message?: string;
    error?: string;
    isDuplicate?: boolean;
    order?: Order;
  } | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Rescue batch form
  const [selectedFoodId, setSelectedFoodId] = useState(foodItems[0]?.id || '');
  const [rescueQuantity, setRescueQuantity] = useState(8);
  const [rescueReason, setRescueReason] = useState('Unreserved lunch rush surplus approved for rescue');
  const [rescueHandling, setRescueHandling] = useState('Hot-holding cabinet at 68°C. Tamper-evident seals.');
  const [isSubmittingRescue, setIsSubmittingRescue] = useState(false);

  // Preorder quote form
  const [selectedPreorderId, setSelectedPreorderId] = useState<string | null>(null);
  const [quoteAmount, setQuoteAmount] = useState('1850');
  const [quoteRemarks, setQuoteRemarks] = useState('Confirmed kitchen capacity. Trays and serving spoons included.');

  const handleScanSubmit = async (e?: React.FormEvent, directToken?: string) => {
    if (e) e.preventDefault();
    const token = directToken || tokenInput;
    if (!token.trim()) return;

    setIsScanning(true);
    setScanResult(null);
    try {
      const res = await onScanToken(token.trim());
      setScanResult(res);
      if (res.success) {
        setTokenInput('');
      }
    } finally {
      setIsScanning(false);
    }
  };

  const pendingOrders = orders.filter((o) => o.collectionStatus !== 'COLLECTED');
  const collectedOrders = orders.filter((o) => o.collectionStatus === 'COLLECTED');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Canteen Staff Header Banner */}
      <div className="bg-gradient-to-r from-[#162238] via-[#111B2E] to-[#0B1220] rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E] px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
            🧑‍🍳 CANTEEN STAFF CONSOLE · CENTRAL FOOD COURT
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Order Queue & QR Verification Counter
          </h1>
          <p className="text-xs text-slate-400">
            Validated by Chef Rajesh Kumar · Counter 2 Pickup Management · Zero Waste Tracking
          </p>
        </div>

        {/* Quick Stats Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#0B1220] p-3 rounded-2xl border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Orders Today</span>
            <span className="text-xl font-black text-white font-mono">{orders.length}</span>
          </div>

          <div className="bg-[#0B1220] p-3 rounded-2xl border border-slate-800 text-center">
            <span className="text-[10px] text-amber-400 uppercase font-bold block">Ready for Pickup</span>
            <span className="text-xl font-black text-amber-400 font-mono">{pendingOrders.length}</span>
          </div>

          <div className="bg-[#0B1220] p-3 rounded-2xl border border-slate-800 text-center">
            <span className="text-[10px] text-emerald-400 uppercase font-bold block">Handed Over</span>
            <span className="text-xl font-black text-emerald-400 font-mono">{collectedOrders.length}</span>
          </div>

          <div className="bg-[#0B1220] p-3 rounded-2xl border border-slate-800 text-center">
            <span className="text-[10px] text-[#FB923C] uppercase font-bold block">Rescue Batches</span>
            <span className="text-xl font-black text-[#FB923C] font-mono">{rescueBatches.length}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'scanner', label: 'Scan Pickup QR', icon: QrCode },
          { id: 'queue', label: `Order Queue (${pendingOrders.length})`, icon: Clock },
          { id: 'rescue', label: 'Surplus & Rescue Batches', icon: Sparkles },
          { id: 'preorders', label: `Party Preorders (${preorders.length})`, icon: Users },
          { id: 'stock', label: 'Menu Stock Control', icon: Package },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setScanResult(null);
              }}
              className={`flex items-center gap-2 px-4 py-3 rounded-t-2xl text-xs font-bold transition-colors whitespace-nowrap border-b-2 ${
                isActive
                  ? 'border-[#22C55E] text-[#22C55E] bg-[#111B2E]'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: QR SCANNER WITH ATOMIC SINGLE-USE ENFORCEMENT */}
      {activeTab === 'scanner' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Scanner Controls Card */}
          <div className="bg-[#111B2E] rounded-3xl p-6 border border-slate-800 space-y-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-[#22C55E]" />
                <h2 className="text-lg font-black text-white">Scan & Verify Student Token</h2>
              </div>
              <p className="text-xs text-slate-400">
                Staff camera scanner with cryptographic single-use redemption lock.
              </p>
            </div>

            {/* Viewfinder Graphic (Simulating Camera Scanner) */}
            <div className="relative bg-[#0B1220] rounded-3xl border-2 border-dashed border-slate-700 h-64 flex flex-col items-center justify-center p-6 text-center overflow-hidden">
              <div className="w-40 h-40 border-2 border-[#22C55E] rounded-2xl relative flex items-center justify-center animate-pulse">
                <Camera className="w-12 h-12 text-[#22C55E]/60" />
                <div className="absolute inset-x-0 top-1/2 h-0.5 bg-[#22C55E] shadow-lg shadow-green-500/50" />
              </div>
              <span className="text-xs text-slate-400 mt-3 font-semibold">
                Camera Viewfinder Active · Optical & Token Scanner
              </span>
            </div>

            {/* Manual Token Entry Form */}
            <form onSubmit={(e) => handleScanSubmit(e)} className="space-y-3">
              <label className="text-xs font-bold text-slate-300 block">
                Enter Alphanumeric Pickup Token or Order Number:
              </label>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. ML-TKN-7821-X4K"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                  className="flex-1 bg-[#162238] border border-slate-700 text-white px-4 py-2.5 rounded-xl font-mono text-xs font-bold uppercase focus:outline-none focus:border-[#22C55E]"
                />
                <button
                  type="submit"
                  disabled={isScanning || !tokenInput.trim()}
                  className="bg-[#22C55E] hover:bg-green-600 text-[#0B1220] px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50"
                >
                  {isScanning ? 'Verifying...' : 'Verify Scan'}
                </button>
              </div>
            </form>

            {/* Demo Quick-Select Tokens for Instant Testing */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Demo Token Presets for Instant Testing:
              </span>
              <div className="space-y-1.5">
                {orders.slice(0, 3).map((ord) => (
                  <button
                    key={ord.id}
                    type="button"
                    onClick={() => handleScanSubmit(undefined, ord.pickupToken)}
                    className="w-full bg-[#162238] hover:bg-[#1E2D4A] border border-slate-700/80 p-2.5 rounded-xl text-left flex items-center justify-between text-xs transition-colors"
                  >
                    <div>
                      <span className="font-mono font-bold text-amber-400 block">
                        {ord.pickupToken}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {ord.orderNumber} · {ord.userName} ({ord.collectionStatus})
                      </span>
                    </div>
                    <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-2 py-1 rounded">
                      Test Scan →
                    </span>
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Verification Results Panel */}
          <div className="space-y-4">
            {scanResult ? (
              <div
                className={`rounded-3xl p-6 border shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 ${
                  scanResult.success
                    ? 'bg-[#111B2E] border-emerald-500/80 ring-1 ring-emerald-500/30'
                    : scanResult.isDuplicate
                    ? 'bg-[#111B2E] border-red-500/80 ring-1 ring-red-500/30'
                    : 'bg-[#111B2E] border-amber-500/80'
                }`}
              >
                {/* Result Header */}
                <div className="flex items-start gap-4">
                  {scanResult.success ? (
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-8 h-8" />
                    </div>
                  )}

                  <div>
                    <h3
                      className={`text-base font-black ${
                        scanResult.success ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {scanResult.success
                        ? 'PICKUP VERIFIED & HANDED OVER'
                        : scanResult.isDuplicate
                        ? 'DUPLICATE SCAN REJECTED'
                        : 'SCAN ERROR'}
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      {scanResult.message || scanResult.error}
                    </p>
                  </div>
                </div>

                {/* If order details attached */}
                {scanResult.order && (
                  <div className="bg-[#0B1220] rounded-2xl p-4 border border-slate-800 space-y-3 text-xs">
                    <div className="flex justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Order Number</span>
                      <span className="font-bold text-white">{scanResult.order.orderNumber}</span>
                    </div>

                    <div className="flex justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Student Name</span>
                      <span className="font-bold text-white">{scanResult.order.userName}</span>
                    </div>

                    <div className="flex justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Paid Amount</span>
                      <span className="font-mono font-bold text-[#22C55E]">
                        ₹{scanResult.order.payableAmountPaise / 100}
                      </span>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <span className="text-slate-400 font-bold block">
                        Items to Hand Over ({scanResult.order.items.length}):
                      </span>
                      {scanResult.order.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between text-white font-semibold">
                          <span>• {it.name}</span>
                          <span className="text-slate-400">Qty: {it.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Audit Notice */}
                <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Single-use token locked. Audit record generated.</span>
                </div>
              </div>
            ) : (
              <div className="bg-[#111B2E] rounded-3xl p-10 border border-slate-800 text-center space-y-3 h-full flex flex-col items-center justify-center">
                <QrCode className="w-12 h-12 text-slate-600" />
                <h3 className="text-base font-bold text-slate-300">Awaiting Scan</h3>
                <p className="text-xs text-slate-400 max-w-xs">
                  Scan a student&apos;s phone QR code or use the demo presets on the left to verify payment and hand over the meal.
                </p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 2: LIVE ORDER QUEUE */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-white">Live Kitchen Order Queue</h2>
            <span className="text-xs text-slate-400">{orders.length} total orders recorded today</span>
          </div>

          <div className="space-y-3">
            {orders.map((ord) => {
              const isCollected = ord.collectionStatus === 'COLLECTED';
              return (
                <div
                  key={ord.id}
                  className="bg-[#111B2E] p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-white text-sm">
                        {ord.orderNumber}
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          isCollected
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500/20 text-amber-300 animate-pulse'
                        }`}
                      >
                        {ord.collectionStatus.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-slate-400">· Slot: {ord.pickupSlot}</span>
                    </div>

                    <div className="text-xs text-slate-300">
                      <span className="font-bold text-white">{ord.userName}</span> ({ord.userEmail})
                    </div>

                    <div className="text-xs text-slate-400">
                      {ord.items.map((i) => `${i.name} x${i.quantity}`).join(', ')}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="font-mono font-bold text-[#22C55E] block">
                        ₹{ord.payableAmountPaise / 100}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {ord.pickupToken}
                      </span>
                    </div>

                    {!isCollected && (
                      <button
                        onClick={() => handleScanSubmit(undefined, ord.pickupToken)}
                        className="bg-[#22C55E] hover:bg-green-600 text-[#0B1220] px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider"
                      >
                        Verify Handover
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: SURPLUS & RESCUE BATCHES */}
      {activeTab === 'rescue' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Create Rescue Batch Form */}
          <div className="bg-[#111B2E] rounded-3xl p-6 border border-slate-800 space-y-4">
            <div>
              <h3 className="text-base font-black text-white">Approve Canteen Surplus for Rescue</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Only staff can list uncollected prepared portions for progressive discount.
              </p>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSubmittingRescue(true);
                try {
                  await onApproveRescueBatch(selectedFoodId, rescueQuantity, rescueReason, rescueHandling);
                } finally {
                  setIsSubmittingRescue(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Select Food Item</label>
                <select
                  value={selectedFoodId}
                  onChange={(e) => setSelectedFoodId(e.target.value)}
                  className="w-full bg-[#162238] border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
                >
                  {foodItems.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.imageEmoji} {f.name} (Regular ₹{f.pricePaise / 100})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Portions to Approve</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={rescueQuantity}
                  onChange={(e) => setRescueQuantity(parseInt(e.target.value) || 1)}
                  className="w-full bg-[#162238] border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Reason for Surplus</label>
                <input
                  type="text"
                  value={rescueReason}
                  onChange={(e) => setRescueReason(e.target.value)}
                  className="w-full bg-[#162238] border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Handling & Storage Verification</label>
                <input
                  type="text"
                  value={rescueHandling}
                  onChange={(e) => setRescueHandling(e.target.value)}
                  className="w-full bg-[#162238] border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingRescue}
                className="w-full bg-[#FB923C] hover:bg-orange-600 text-[#0B1220] py-2.5 rounded-xl text-xs font-black uppercase tracking-wider"
              >
                {isSubmittingRescue ? 'Approving...' : 'Approve Rescue Batch →'}
              </button>
            </form>
          </div>

          {/* Active Rescue Batches List */}
          <div className="space-y-4">
            <h3 className="text-base font-black text-white">Active Rescue Batches ({rescueBatches.length})</h3>
            <div className="space-y-3">
              {rescueBatches.map((rb) => (
                <div key={rb.id} className="bg-[#111B2E] p-4 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-white text-sm">{rb.foodItemName}</h4>
                      <span className="text-[11px] text-slate-400">{rb.reason}</span>
                    </div>
                    <span className="bg-orange-500/20 text-[#FB923C] text-xs font-bold px-2 py-0.5 rounded">
                      {rb.currentDiscountPercent}% OFF
                    </span>
                  </div>

                  <div className="flex justify-between text-xs text-slate-300 pt-1 border-t border-slate-800">
                    <span>Remaining: <strong>{rb.quantityAvailable} portions</strong></span>
                    <span className="font-mono text-[#22C55E] font-bold">₹{rb.currentPricePaise / 100}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* TAB 4: PARTY PREORDERS */}
      {activeTab === 'preorders' && (
        <div className="space-y-4">
          <h2 className="text-lg font-black text-white">Student Celebration & Birthday Preorders</h2>
          <div className="space-y-4">
            {preorders.map((po) => (
              <div key={po.id} className="bg-[#111B2E] p-5 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-black text-white text-base">{po.eventTitle}</h3>
                    <span className="text-xs text-slate-400">
                      Organized by {po.studentName} ({po.contactPhone}) · {po.headCount} Guests
                    </span>
                    <span className="text-xs text-amber-400 block mt-0.5">
                      Date: {po.eventDate} at {po.pickupTime} (Pickup from Kitchen)
                    </span>
                  </div>

                  <span className="bg-slate-800 text-slate-300 px-2.5 py-1 rounded text-xs font-mono font-bold">
                    {po.status}
                  </span>
                </div>

                <div className="bg-[#0B1220] p-3 rounded-xl border border-slate-800 text-xs text-slate-300">
                  <span className="font-bold block text-white mb-1">Requested Food:</span>
                  {po.itemsRequested.map((it, idx) => (
                    <span key={idx} className="block">• {it.name} (Qty: {it.quantity})</span>
                  ))}
                  {po.specialInstructions && (
                    <span className="block mt-1 text-slate-400 italic">Notes: {po.specialInstructions}</span>
                  )}
                </div>

                {po.status === 'PENDING_REVIEW' && (
                  <div className="flex items-center gap-3 pt-2">
                    <input
                      type="number"
                      placeholder="Enter Quoted Price in ₹"
                      value={quoteAmount}
                      onChange={(e) => setQuoteAmount(e.target.value)}
                      className="bg-[#162238] border border-slate-700 text-white px-3 py-1.5 rounded-xl text-xs font-mono font-bold"
                    />
                    <button
                      onClick={() => onQuotePreorder(po.id, parseInt(quoteAmount) * 100, quoteRemarks)}
                      className="bg-[#22C55E] text-[#0B1220] px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider"
                    >
                      Send Quote to Student
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: STOCK CONTROL */}
      {activeTab === 'stock' && (
        <div className="space-y-4">
          <h2 className="text-lg font-black text-white">Live Menu Stock Controller</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {foodItems.map((fi) => (
              <div key={fi.id} className="bg-[#111B2E] p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-white text-xs">{fi.imageEmoji} {fi.name}</h4>
                  <span className="text-[11px] text-slate-400 font-mono">Current Stock: {fi.stockAvailable}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onUpdateStock(fi.id, Math.max(0, fi.stockAvailable - 5))}
                    className="w-7 h-7 bg-[#162238] hover:bg-slate-700 text-white rounded-lg flex items-center justify-center font-bold text-xs"
                  >
                    -5
                  </button>
                  <button
                    onClick={() => onUpdateStock(fi.id, fi.stockAvailable + 10)}
                    className="w-7 h-7 bg-[#22C55E] hover:bg-green-600 text-[#0B1220] rounded-lg flex items-center justify-center font-bold text-xs"
                  >
                    +10
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
