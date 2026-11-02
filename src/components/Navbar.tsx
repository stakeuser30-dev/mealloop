import React, { useState } from 'react';
import {
  Utensils,
  QrCode,
  Users,
  Sparkles,
  ShoppingBag,
  Clock,
  Shield,
  HeartHandshake,
  Bot,
  RotateCcw,
  Check,
  ChevronDown,
  Layers,
  Award,
  LogOut,
  User as UserIcon,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { User, UserRole } from '../types';

interface NavbarProps {
  currentUser: User;
  activeRole: string;
  onSwitchRole: (role: 'student' | 'staff' | 'admin' | 'ngo') => void;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  cartItemCount: number;
  cartTotalPaise: number;
  onOpenCart: () => void;
  onOpenAI: () => void;
  onOpenQR: () => void;
  demoClockOffsetHours: number;
  onAdvanceClock: (hours: number) => void;
  onResetClock: () => void;
  firebaseUser?: any;
  onGoogleSignIn?: () => void;
  onGoogleSignOut?: () => void;
  isAuthLoading?: boolean;
  authError?: string | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  activeRole,
  onSwitchRole,
  activeTab,
  onSelectTab,
  cartItemCount,
  cartTotalPaise,
  onOpenCart,
  onOpenAI,
  onOpenQR,
  demoClockOffsetHours,
  onAdvanceClock,
  onResetClock,
  firebaseUser,
  onGoogleSignIn,
  onGoogleSignOut,
  isAuthLoading,
  authError,
}) => {
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showClockDropdown, setShowClockDropdown] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const roles = [
    { id: 'student', label: 'Student', name: 'Aarav Sharma', emoji: '🎓', desc: 'Browse, order, group deals, AI assistant' },
    { id: 'staff', label: 'Canteen Staff', name: 'Chef Rajesh Kumar', emoji: '🧑‍🍳', desc: 'Order queue, QR scanner, rescue batches' },
    { id: 'admin', label: 'Admin', name: 'Dr. Priya Nair', emoji: '🛡️', desc: 'Platform metrics, audit logs, coupon rules' },
    { id: 'ngo', label: 'NGO Partner', name: 'Ananya Roy (RHA)', emoji: '🤝', desc: 'Food donation offers & handover' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#0B1220]/95 backdrop-blur-md border-b border-slate-800">
      {/* Top Banner: Campus & Demo Controls */}
      <div className="bg-[#111B2E] border-b border-slate-800/80 px-4 py-1.5 text-xs text-slate-300">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
            <span className="font-semibold text-white">Central Campus Food Court</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-400 hidden sm:inline">SAC Ground Floor · Counter Pickup Only (No Delivery Riders)</span>
          </div>

          {/* Demo Controls Strip */}
          <div className="flex items-center gap-3">
            {/* Demo Clock Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowClockDropdown(!showClockDropdown)}
                className="flex items-center gap-1.5 bg-[#162238] hover:bg-[#1E2D4A] text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-lg font-mono font-bold text-[11px] transition-colors"
                title="Simulate progressive rescue discount schedule"
              >
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Demo Clock: +{demoClockOffsetHours}h</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {showClockDropdown && (
                <div className="absolute right-0 mt-1 w-64 bg-[#162238] border border-slate-700 rounded-xl shadow-2xl p-3 z-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Progressive Clock Control</span>
                    <button
                      onClick={() => {
                        onResetClock();
                        setShowClockDropdown(false);
                      }}
                      className="text-[10px] text-red-400 hover:underline flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" /> Reset
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Advance virtual time to watch surplus meals progress through discounts (7% → 15% → 23% → 30%) and trigger NGO notification!
                  </p>
                  <div className="grid grid-cols-4 gap-1 pt-1">
                    {[1, 2, 3, 4].map((hr) => (
                      <button
                        key={hr}
                        onClick={() => {
                          onAdvanceClock(hr);
                          setShowClockDropdown(false);
                        }}
                        className="bg-[#111B2E] hover:bg-[#22C55E]/20 hover:text-[#22C55E] text-slate-200 border border-slate-700 py-1.5 rounded-lg text-xs font-bold text-center transition-colors"
                      >
                        +{hr}h
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Role Switcher Pill */}
            <div className="relative">
              <button
                onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                className="flex items-center gap-1.5 bg-[#162238] hover:bg-[#1E2D4A] text-slate-200 border border-slate-700 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors"
              >
                <span>Role:</span>
                <span className="text-[#22C55E] font-black">{currentUser.role}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {showRoleDropdown && (
                <div className="absolute right-0 mt-1 w-72 bg-[#162238] border border-slate-700 rounded-xl shadow-2xl p-2 z-50 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1 block">
                    Switch Demo Persona
                  </span>
                  {roles.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        onSwitchRole(r.id as any);
                        setShowRoleDropdown(false);
                      }}
                      className={`w-full p-2 rounded-lg text-left text-xs transition-colors flex items-start gap-2.5 ${
                        activeRole === r.id
                          ? 'bg-[#22C55E]/15 border border-[#22C55E]/40 text-white'
                          : 'hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <span className="text-lg">{r.emoji}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white">{r.name}</span>
                          <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded font-mono">
                            {r.label}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 block mt-0.5 leading-tight">
                          {r.desc}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Brand Logo */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => onSelectTab('menu')}
              className="flex items-center gap-2.5 text-left group"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#22C55E] to-[#15803D] flex items-center justify-center text-white font-black text-xl shadow-lg shadow-green-500/20 group-hover:scale-105 transition-transform">
                <Utensils className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xl font-black tracking-tight text-white leading-none">
                    Meal<span className="text-[#22C55E]">Loop</span>
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-wider bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
                    CAMPUS
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                  Smart Canteen & Pickup QR
                </span>
              </div>
            </button>
          </div>

          {/* Navigation Links according to Active Role */}
          <nav className="hidden md:flex items-center gap-1 bg-[#111B2E] p-1 rounded-xl border border-slate-800">
            {currentUser.role === 'STUDENT' && (
              <>
                <button
                  onClick={() => onSelectTab('menu')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'menu' ? 'bg-[#162238] text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Regular Menu
                </button>
                <button
                  onClick={() => onSelectTab('group-deals')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'group-deals' ? 'bg-[#162238] text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-amber-400" />
                  Group Deals
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-mono font-bold">
                    6/8 Joined
                  </span>
                </button>
                <button
                  onClick={() => onSelectTab('rescue')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'rescue' ? 'bg-[#162238] text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#FB923C]" />
                  Rescue Meals
                  <span className="text-[10px] bg-orange-500/20 text-orange-300 px-1.5 py-0.2 rounded font-bold">
                    Up to 30% Off
                  </span>
                </button>
                <button
                  onClick={() => onSelectTab('membership')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'membership' ? 'bg-[#162238] text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Award className="w-3.5 h-3.5 text-emerald-400" />
                  Student Pass
                </button>
                <button
                  onClick={() => onSelectTab('orders')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'orders' ? 'bg-[#162238] text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5 text-[#22C55E]" />
                  My Pickup QRs
                </button>
              </>
            )}

            {currentUser.role === 'CANTEEN_STAFF' && (
              <>
                <button
                  onClick={() => onSelectTab('staff-queue')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'staff-queue' ? 'bg-[#162238] text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Live Order Queue
                </button>
                <button
                  onClick={() => onSelectTab('staff-scanner')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  Scan Pickup QR
                </button>
                <button
                  onClick={() => onSelectTab('staff-rescue')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'staff-rescue' ? 'bg-[#162238] text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Surplus & Rescue Batches
                </button>
                <button
                  onClick={() => onSelectTab('staff-preorders')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'staff-preorders' ? 'bg-[#162238] text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Party Preorders
                </button>
              </>
            )}

            {currentUser.role === 'ADMIN' && (
              <>
                <button
                  onClick={() => onSelectTab('admin-metrics')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'admin-metrics' ? 'bg-[#162238] text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Verified Outcome Metrics
                </button>
                <button
                  onClick={() => onSelectTab('admin-logs')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'admin-logs' ? 'bg-[#162238] text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Security Audit Logs
                </button>
                <button
                  onClick={() => onSelectTab('admin-rules')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'admin-rules' ? 'bg-[#162238] text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Discounts & Coupon Rules
                </button>
              </>
            )}

            {currentUser.role === 'NGO' && (
              <>
                <button
                  onClick={() => onSelectTab('ngo-offers')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'ngo-offers' ? 'bg-[#162238] text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Available Food Batches
                </button>
                <button
                  onClick={() => onSelectTab('ngo-history')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'ngo-history' ? 'bg-[#162238] text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Verified Handover History
                </button>
              </>
            )}
          </nav>

          {/* Action Zone: Google Login, AI Assistant & Cart */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Real Google Auth / Profile Zone */}
            {firebaseUser ? (
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 bg-[#162238] hover:bg-[#1E2D4A] border border-slate-700/80 p-1 sm:px-2.5 sm:py-1.5 rounded-xl transition-all"
                  title="Google Account Profile"
                >
                  {firebaseUser.photoURL ? (
                    <img
                      src={firebaseUser.photoURL}
                      alt={firebaseUser.displayName || 'User'}
                      className="w-7 h-7 rounded-full object-cover ring-1 ring-[#22C55E]/60"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-[#22C55E]/20 text-[#22C55E] flex items-center justify-center font-bold text-xs">
                      {(firebaseUser.displayName || firebaseUser.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="text-left hidden lg:block">
                    <p className="text-xs font-bold text-white leading-tight truncate max-w-[100px]">
                      {firebaseUser.displayName || firebaseUser.email?.split('@')[0]}
                    </p>
                    <span className="text-[10px] text-emerald-400 font-mono font-medium block">
                      Google ID
                    </span>
                  </div>
                  <ChevronDown className="w-3 h-3 text-slate-400 hidden sm:block" />
                </button>

                {/* Dropdown Menu */}
                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-72 bg-[#162238] border border-slate-700 rounded-2xl shadow-2xl p-3 z-50 space-y-3">
                    <div className="flex items-center gap-3 pb-3 border-b border-slate-700/70">
                      {firebaseUser.photoURL ? (
                        <img
                          src={firebaseUser.photoURL}
                          alt="Avatar"
                          className="w-10 h-10 rounded-full object-cover ring-2 ring-[#22C55E]"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#22C55E]/20 text-[#22C55E] flex items-center justify-center font-bold text-sm">
                          {(firebaseUser.displayName || 'U')[0].toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 overflow-hidden">
                        <p className="font-bold text-white text-sm truncate">{firebaseUser.displayName || 'Campus Student'}</p>
                        <p className="text-xs text-slate-400 truncate">{firebaseUser.email}</p>
                        <span className="inline-block mt-1 text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono border border-slate-700">
                          Role: {currentUser.role}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-300">
                      <div className="flex justify-between py-1 px-1.5 rounded-lg bg-[#111B2E]">
                        <span className="text-slate-400">Student Coins</span>
                        <span className="font-mono font-bold text-amber-400">{currentUser.loyaltyCoins ?? 50} coins</span>
                      </div>
                      <div className="flex justify-between py-1 px-1.5 rounded-lg bg-[#111B2E]">
                        <span className="text-slate-400">Campus Pass</span>
                        <span className={`font-bold ${currentUser.hasActiveMembership ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {currentUser.hasActiveMembership ? 'Active (10% Off)' : 'Standard'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        onGoogleSignOut?.();
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 text-xs font-bold transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={onGoogleSignIn}
                  disabled={isAuthLoading}
                  className="flex items-center gap-2 bg-white hover:bg-slate-100 text-[#0B1220] font-bold px-3 py-2 rounded-xl text-xs transition-all shadow-md active:scale-95 disabled:opacity-70 group"
                  title="Sign in with your Google account"
                >
                  {isAuthLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#0B1220]" />
                  ) : (
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
                  )}
                  <span className="hidden sm:inline">Google Login</span>
                </button>

                {authError && (
                  <div className="absolute top-full right-0 mt-2 w-64 bg-red-950/90 border border-red-500/40 text-red-200 p-2.5 rounded-xl text-[11px] shadow-xl z-50 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                )}
              </div>
            )}

            {/* AI Assistant Button */}
            <button
              onClick={onOpenAI}
              className="flex items-center gap-2 bg-[#162238] hover:bg-[#1E2D4A] text-slate-200 border border-slate-700/80 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 group"
            >
              <Bot className="w-4 h-4 text-[#22C55E] group-hover:scale-110 transition-transform" />
              <span className="hidden md:inline">Ask LoopAI</span>
              <span className="text-[10px] bg-[#22C55E]/20 text-[#22C55E] px-1.5 py-0.2 rounded font-mono font-bold">
                Tools
              </span>
            </button>

            {/* Cart Trigger */}
            {currentUser.role === 'STUDENT' && (
              <button
                onClick={onOpenCart}
                className="flex items-center gap-2 bg-[#22C55E] hover:bg-green-600 text-[#0B1220] font-black px-3.5 py-2 rounded-xl text-xs shadow-md transition-all active:scale-95"
              >
                <ShoppingBag className="w-4 h-4" />
                <span className="font-mono">₹{cartTotalPaise / 100}</span>
                {cartItemCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-[#0B1220] text-white text-[10px] flex items-center justify-center font-bold">
                    {cartItemCount}
                  </span>
                )}
              </button>
            )}

            {/* Staff Fast Scanner Button */}
            {currentUser.role === 'CANTEEN_STAFF' && (
              <button
                onClick={() => onSelectTab('staff-scanner')}
                className="flex items-center gap-2 bg-[#22C55E] hover:bg-green-600 text-[#0B1220] font-black px-3.5 py-2 rounded-xl text-xs shadow-md transition-all active:scale-95"
              >
                <QrCode className="w-4 h-4" />
                <span className="hidden sm:inline">Scan QR</span>
              </button>
            )}
          </div>

        </div>

        {/* Mobile Navigation Tabs Bar */}
        <div className="flex md:hidden overflow-x-auto no-scrollbar py-2 gap-1.5 border-t border-slate-800 text-xs">
          {currentUser.role === 'STUDENT' && (
            <>
              <button
                onClick={() => onSelectTab('menu')}
                className={`px-3 py-1.5 rounded-lg font-bold shrink-0 ${
                  activeTab === 'menu' ? 'bg-[#22C55E] text-[#0B1220]' : 'bg-[#111B2E] text-slate-300'
                }`}
              >
                Menu
              </button>
              <button
                onClick={() => onSelectTab('group-deals')}
                className={`px-3 py-1.5 rounded-lg font-bold shrink-0 ${
                  activeTab === 'group-deals' ? 'bg-[#22C55E] text-[#0B1220]' : 'bg-[#111B2E] text-slate-300'
                }`}
              >
                Group Deals (6/8)
              </button>
              <button
                onClick={() => onSelectTab('rescue')}
                className={`px-3 py-1.5 rounded-lg font-bold shrink-0 ${
                  activeTab === 'rescue' ? 'bg-[#22C55E] text-[#0B1220]' : 'bg-[#111B2E] text-slate-300'
                }`}
              >
                Rescue Meals
              </button>
              <button
                onClick={() => onSelectTab('orders')}
                className={`px-3 py-1.5 rounded-lg font-bold shrink-0 ${
                  activeTab === 'orders' ? 'bg-[#22C55E] text-[#0B1220]' : 'bg-[#111B2E] text-slate-300'
                }`}
              >
                Pickup QRs
              </button>
            </>
          )}

          {currentUser.role === 'CANTEEN_STAFF' && (
            <>
              <button
                onClick={() => onSelectTab('staff-queue')}
                className={`px-3 py-1.5 rounded-lg font-bold shrink-0 ${
                  activeTab === 'staff-queue' ? 'bg-[#22C55E] text-[#0B1220]' : 'bg-[#111B2E] text-slate-300'
                }`}
              >
                Queue
              </button>
              <button
                onClick={() => onSelectTab('staff-scanner')}
                className={`px-3 py-1.5 rounded-lg font-bold shrink-0 ${
                  activeTab === 'staff-scanner' ? 'bg-[#22C55E] text-[#0B1220]' : 'bg-[#111B2E] text-slate-300'
                }`}
              >
                Scan QR
              </button>
              <button
                onClick={() => onSelectTab('staff-rescue')}
                className={`px-3 py-1.5 rounded-lg font-bold shrink-0 ${
                  activeTab === 'staff-rescue' ? 'bg-[#22C55E] text-[#0B1220]' : 'bg-[#111B2E] text-slate-300'
                }`}
              >
                Rescue
              </button>
            </>
          )}

          {currentUser.role === 'ADMIN' && (
            <>
              <button
                onClick={() => onSelectTab('admin-metrics')}
                className={`px-3 py-1.5 rounded-lg font-bold shrink-0 ${
                  activeTab === 'admin-metrics' ? 'bg-[#22C55E] text-[#0B1220]' : 'bg-[#111B2E] text-slate-300'
                }`}
              >
                Metrics
              </button>
              <button
                onClick={() => onSelectTab('admin-logs')}
                className={`px-3 py-1.5 rounded-lg font-bold shrink-0 ${
                  activeTab === 'admin-logs' ? 'bg-[#22C55E] text-[#0B1220]' : 'bg-[#111B2E] text-slate-300'
                }`}
              >
                Audit Logs
              </button>
            </>
          )}

          {currentUser.role === 'NGO' && (
            <>
              <button
                onClick={() => onSelectTab('ngo-offers')}
                className={`px-3 py-1.5 rounded-lg font-bold shrink-0 ${
                  activeTab === 'ngo-offers' ? 'bg-[#22C55E] text-[#0B1220]' : 'bg-[#111B2E] text-slate-300'
                }`}
              >
                Donation Offers
              </button>
              <button
                onClick={() => onSelectTab('ngo-history')}
                className={`px-3 py-1.5 rounded-lg font-bold shrink-0 ${
                  activeTab === 'ngo-history' ? 'bg-[#22C55E] text-[#0B1220]' : 'bg-[#111B2E] text-slate-300'
                }`}
              >
                History
              </button>
            </>
          )}
        </div>

      </div>
    </header>
  );
};
