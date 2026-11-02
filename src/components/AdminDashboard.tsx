import React, { useState } from 'react';
import { Shield, BarChart3, FileText, CheckCircle2, AlertTriangle, Users, Sparkles, HeartHandshake } from 'lucide-react';
import { PlatformMetrics, AuditLog, Coupon } from '../types';

interface AdminDashboardProps {
  metrics: PlatformMetrics;
  auditLogs: AuditLog[];
  coupons: Coupon[];
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  metrics,
  auditLogs,
  coupons,
}) => {
  const [activeTab, setActiveTab] = useState<'metrics' | 'audit' | 'rules'>('metrics');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Admin Header */}
      <div className="bg-gradient-to-r from-slate-900 via-[#111B2E] to-[#0B1220] rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl space-y-2">
        <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
          <Shield className="w-4 h-4" />
          Campus Administration & Dean of Student Affairs
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Campus Food Operations, Verified Outcomes & Audit
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
          Honest verified platform reporting. Metrics only reflect verified collections and authenticated handovers—never uncollected listings or preliminary reservations.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-4 text-xs font-bold">
        <button
          onClick={() => setActiveTab('metrics')}
          className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'metrics'
              ? 'border-[#22C55E] text-[#22C55E]'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Verified Outcomes & Metrics
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'audit'
              ? 'border-[#22C55E] text-[#22C55E]'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          Cryptographic Audit Logs ({auditLogs.length})
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'rules'
              ? 'border-[#22C55E] text-[#22C55E]'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Shield className="w-4 h-4" />
          Discount Rules & Anti-Stacking Policy
        </button>
      </div>

      {/* METRICS TAB */}
      {activeTab === 'metrics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-[#111B2E] p-5 rounded-3xl border border-slate-800 space-y-2">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">
                Verified Student Pickups
              </span>
              <span className="text-3xl font-black text-white font-mono block">
                {metrics.verifiedPickupsCount}
              </span>
              <span className="text-[11px] text-emerald-400 font-semibold block">
                Single-use QR redeemed at Counter 2
              </span>
            </div>

            <div className="bg-[#111B2E] p-5 rounded-3xl border border-slate-800 space-y-2">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">
                Rescue Meals Saved
              </span>
              <span className="text-3xl font-black text-[#FB923C] font-mono block">
                {metrics.totalRescueMealsSold}
              </span>
              <span className="text-[11px] text-slate-400 font-semibold block">
                Sold before progressive cutoff
              </span>
            </div>

            <div className="bg-[#111B2E] p-5 rounded-3xl border border-slate-800 space-y-2">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">
                NGO Handover Portions
              </span>
              <span className="text-3xl font-black text-emerald-400 font-mono block">
                {metrics.totalDonationsHandedOver}
              </span>
              <span className="text-[11px] text-slate-400 font-semibold block">
                Verified transfer to Robin Hood Army
              </span>
            </div>

            <div className="bg-[#111B2E] p-5 rounded-3xl border border-slate-800 space-y-2">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">
                Student Savings (INR)
              </span>
              <span className="text-3xl font-black text-[#22C55E] font-mono block">
                ₹{metrics.totalStudentSavingsPaise / 100}
              </span>
              <span className="text-[11px] text-slate-400 font-semibold block">
                Direct discounts + membership benefits
              </span>
            </div>

          </div>

          {/* Waste Transparency Box */}
          <div className="bg-[#162238] rounded-3xl p-6 border border-slate-700/80 space-y-3">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-base font-black">Food Waste & Safety Transparency</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
              MealLoop enforces strict food safety: meals past their certified safety cutoff are NEVER sold or handed over. In this period, <strong>{metrics.totalDiscardedPortions} portions</strong> reached cutoff and were discarded responsibly according to campus compost guidelines.
            </p>
          </div>
        </div>
      )}

      {/* AUDIT LOGS TAB */}
      {activeTab === 'audit' && (
        <div className="bg-[#111B2E] rounded-3xl border border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-800 font-bold text-xs text-slate-400 uppercase tracking-wider">
            Server-Side Recorded Audit Trail
          </div>

          <div className="divide-y divide-slate-800 max-h-[600px] overflow-y-auto">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-[#162238]/50 transition-colors space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                        log.actorRole === 'CANTEEN_STAFF'
                          ? 'bg-amber-500/20 text-amber-300'
                          : log.actorRole === 'STUDENT'
                          ? 'bg-[#22C55E]/20 text-[#22C55E]'
                          : log.actorRole === 'ADMIN'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-purple-500/20 text-purple-300'
                      }`}
                    >
                      {log.actorRole}
                    </span>
                    <span className="font-bold text-white">{log.actorName}</span>
                    <span className="text-slate-400">· {log.action}</span>
                  </div>

                  <span className="font-mono text-[11px] text-slate-400">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <p className="text-slate-300 text-xs pl-0.5">{log.details}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RULES TAB */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          <div className="bg-[#111B2E] rounded-3xl p-6 border border-slate-800 space-y-4">
            <h3 className="text-base font-black text-white">Strict Anti-Stacking Discount Policy</h3>
            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 rounded-2xl bg-[#162238] border border-slate-700">
                <span className="font-bold text-white block mb-0.5">1. Base Price Hierarchy</span>
                <span>By default, only ONE of Regular Price, Group Deal Price, Rescue Meal Price, or Campus Fest Special Price applies to a given food item. They never stack concurrently.</span>
              </div>

              <div className="p-3 rounded-2xl bg-[#162238] border border-slate-700">
                <span className="font-bold text-white block mb-0.5">2. Membership Application</span>
                <span>The 30-Day Student Membership 10% discount applies ONLY to regular menu items, not already heavily discounted rescue meals or unlocked group thresholds.</span>
              </div>

              <div className="p-3 rounded-2xl bg-[#162238] border border-slate-700">
                <span className="font-bold text-white block mb-0.5">3. Referral Credits</span>
                <span>Referral wallet credits are capped at ₹25 per order to prevent malicious redemption while rewarding student advocates fairly.</span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
