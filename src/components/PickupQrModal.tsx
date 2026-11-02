import React, { useEffect, useState } from 'react';
import { X, QrCode, ShieldCheck, CheckCircle2, Clock, MapPin, AlertCircle, Copy, Check } from 'lucide-react';
import QRCode from 'qrcode';
import { Order } from '../types';

interface PickupQrModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PickupQrModal: React.FC<PickupQrModalProps> = ({ order, isOpen, onClose }) => {
  const [generatedQr, setGeneratedQr] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!order) return;
    if (order.pickupQrUrl) {
      setGeneratedQr(order.pickupQrUrl);
    } else {
      QRCode.toDataURL(order.pickupQrData || order.pickupToken, {
        margin: 2,
        width: 256,
        color: { dark: '#0B1220', light: '#FFFFFF' },
      }).then(setGeneratedQr).catch(console.error);
    }
  }, [order]);

  if (!isOpen || !order) return null;

  const isCollected = order.collectionStatus === 'COLLECTED';

  const copyToken = () => {
    navigator.clipboard.writeText(order.pickupToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-[#111B2E] border border-slate-700/80 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden text-slate-100 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-[#162238]">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-[#22C55E]" />
            <div>
              <h3 className="font-black text-sm text-white">Student Pickup Pass</h3>
              <span className="text-[10px] text-slate-400 font-mono">
                Order #{order.orderNumber}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-center">
          
          {/* Status Banner */}
          <div
            className={`py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider inline-flex items-center gap-2 ${
              isCollected
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30 animate-pulse'
            }`}
          >
            {isCollected ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>ORDER COLLECTED & VERIFIED</span>
              </>
            ) : (
              <>
                <Clock className="w-4 h-4" />
                <span>READY FOR PICKUP AT COUNTER 2</span>
              </>
            )}
          </div>

          {/* QR Code Container */}
          <div className="bg-white p-5 rounded-3xl inline-block shadow-2xl relative mx-auto">
            {generatedQr ? (
              <img
                src={generatedQr}
                alt={`QR code for order ${order.orderNumber}`}
                className="w-56 h-56 mx-auto object-contain"
              />
            ) : (
              <div className="w-56 h-56 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 text-xs font-bold">
                Generating QR...
              </div>
            )}

            {isCollected && (
              <div className="absolute inset-0 bg-slate-900/85 backdrop-blur-xs rounded-3xl flex flex-col items-center justify-center p-4 text-white space-y-2">
                <CheckCircle2 className="w-14 h-14 text-emerald-400" />
                <span className="text-sm font-black uppercase tracking-wider">
                  COLLECTED
                </span>
                <span className="text-[11px] text-slate-300">
                  Single-use token has been redeemed
                </span>
              </div>
            )}
          </div>

          {/* Alphanumeric Token Fallback for Manual Entry */}
          <div className="bg-[#162238] rounded-2xl p-3 border border-slate-700/80 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Pickup Token Code (Staff Manual Fallback)
            </span>
            <div className="flex items-center justify-center gap-2">
              <span className="font-mono text-base font-black text-amber-400 tracking-widest">
                {order.pickupToken}
              </span>
              <button
                onClick={copyToken}
                className="p-1 rounded-md text-slate-400 hover:text-white"
                title="Copy token code"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Location & Time window */}
          <div className="bg-[#0B1220] rounded-2xl p-4 border border-slate-800 text-xs text-left space-y-2">
            <div className="flex justify-between items-start">
              <span className="text-slate-400">Pickup Counter:</span>
              <span className="font-bold text-white text-right">
                {order.canteenName} · Counter 2
              </span>
            </div>

            <div className="flex justify-between items-start">
              <span className="text-slate-400">Time Window:</span>
              <span className="font-bold text-[#22C55E] text-right">
                {order.pickupSlot}
              </span>
            </div>

            <div className="flex justify-between items-start">
              <span className="text-slate-400">Student:</span>
              <span className="font-bold text-white">{order.userName}</span>
            </div>

            <div className="border-t border-slate-800 pt-2 space-y-1">
              <span className="text-slate-400 block font-semibold">Items in Order:</span>
              {order.items.map((it, idx) => (
                <div key={idx} className="flex justify-between text-slate-300 text-[11px]">
                  <span>{it.name} x {it.quantity}</span>
                  <span className="font-mono">₹{(it.pricePaise * it.quantity) / 100}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Security Guarantee */}
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Cryptographically sealed & single-use verified</span>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-[#162238] flex gap-2">
          <button
            onClick={onClose}
            className="w-full bg-[#22C55E] hover:bg-green-600 text-[#0B1220] py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
