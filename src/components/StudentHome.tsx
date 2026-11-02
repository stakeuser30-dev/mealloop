import React, { useState, useMemo } from 'react';
import {
  Search,
  Users,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Plus,
  Minus,
  Check,
  ArrowRight,
  Flame,
  Award,
  ChevronDown,
  Share2,
  MapPin,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { FoodItem, GroupDeal, RescueMealBatch, User, CartItem } from '../types';

interface StudentHomeProps {
  currentUser: User;
  foodItems: FoodItem[];
  groupDeals: GroupDeal[];
  rescueBatches: RescueMealBatch[];
  cartItems: CartItem[];
  onAddToCart: (item: FoodItem, customOptions?: any) => void;
  onAddRescueToCart: (batch: RescueMealBatch) => void;
  onJoinGroupDeal: (dealId: string) => void;
  onSimulatePeerJoin: (dealId: string) => void;
  onSelectFoodDetail: (item: FoodItem) => void;
  onOpenAIWithPrompt: (prompt: string) => void;
  demoClockOffsetHours: number;
  onAdvanceClock: (hours: number) => void;
}

const CATEGORIES = [
  'All',
  'Thalis & Meals',
  'Quick Bites',
  'Breakfast & South',
  'Beverages & Chai',
];

const CAMPUS_LOCATIONS = [
  { id: 'sac-main', name: 'Central Campus Food Court', desc: 'SAC Ground Floor · Counter 2 Pickup' },
  { id: 'hostel-4', name: 'Hostel 4 (Kaveri) Cafeteria', desc: 'Hostel Quadrangle · Counter 1 Pickup' },
  { id: 'tech-hub', name: 'Tech Park Academic Canteen', desc: 'Block C 1st Floor · Counter A' },
];

export const StudentHome: React.FC<StudentHomeProps> = ({
  currentUser,
  foodItems,
  groupDeals,
  rescueBatches,
  cartItems,
  onAddToCart,
  onAddRescueToCart,
  onJoinGroupDeal,
  onSimulatePeerJoin,
  onSelectFoodDetail,
  onOpenAIWithPrompt,
  demoClockOffsetHours,
  onAdvanceClock,
}) => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [budgetLimit, setBudgetLimit] = useState<number | null>(null); // null, 6000, 10000
  const [inStockOnly, setInStockOnly] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(CAMPUS_LOCATIONS[0]);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [copiedDealId, setCopiedDealId] = useState<string | null>(null);

  // Helper: Get current item quantity in cart
  const getCartQuantity = (foodItemId: string) => {
    const item = cartItems.find((ci) => ci.foodItemId === foodItemId && !ci.isRescue);
    return item ? item.quantity : 0;
  };

  const getRescueCartQuantity = (rescueBatchId: string) => {
    const item = cartItems.find((ci) => ci.rescueBatchId === rescueBatchId);
    return item ? item.quantity : 0;
  };

  // Filtered Food Items
  const filteredFoodItems = useMemo(() => {
    return foodItems.filter((item) => {
      if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
      if (vegOnly && !item.isVeg) return false;
      if (budgetLimit && item.pricePaise > budgetLimit) return false;
      if (inStockOnly && item.stockAvailable <= 0) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.ingredients.some((ing) => ing.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [foodItems, selectedCategory, vegOnly, budgetLimit, inStockOnly, searchQuery]);

  const handleCopyShareLink = (dealId: string) => {
    navigator.clipboard.writeText(`https://mealloop.campus.edu/deals/${dealId}`);
    setCopiedDealId(dealId);
    setTimeout(() => setCopiedDealId(null), 2500);
  };

  const resetAllFilters = () => {
    setSelectedCategory('All');
    setSearchQuery('');
    setVegOnly(false);
    setBudgetLimit(null);
    setInStockOnly(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-10">
      
      {/* 1. Campus Location Selector & Header Banner */}
      <section className="bg-gradient-to-r from-[#111B2E] via-[#162238] to-[#0B1220] rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl relative">
        <div className="relative z-10 max-w-3xl space-y-4">
          
          {/* Location Selector Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setShowLocationPicker(!showLocationPicker)}
                className="flex items-center gap-2 bg-[#0B1220] hover:bg-[#162238] text-white border border-slate-700 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                aria-haspopup="listbox"
                aria-expanded={showLocationPicker}
              >
                <MapPin className="w-3.5 h-3.5 text-[#22C55E]" />
                <span>{selectedLocation.name}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showLocationPicker && (
                <div className="absolute left-0 mt-2 w-72 bg-[#162238] border border-slate-700 rounded-2xl shadow-2xl p-2 z-30 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1.5 block">
                    Campus Pickup Points
                  </span>
                  {CAMPUS_LOCATIONS.map((loc) => (
                    <button
                      key={loc.id}
                      onClick={() => {
                        setSelectedLocation(loc);
                        setShowLocationPicker(false);
                      }}
                      className={`w-full text-left p-2.5 rounded-xl text-xs transition-colors ${
                        selectedLocation.id === loc.id
                          ? 'bg-[#22C55E]/15 text-[#22C55E] font-bold border border-[#22C55E]/30'
                          : 'text-slate-200 hover:bg-[#111B2E]'
                      }`}
                    >
                      <div className="font-semibold">{loc.name}</div>
                      <div className="text-[11px] text-slate-400">{loc.desc}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span aria-hidden="true">·</span>
              <span>Open 08:00 AM – 10:30 PM</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-400 font-medium">Counter 2 Pickup Only</span>
            </div>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Order in Advance. Skip Queues. Save Surplus.
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
            Preorder your campus meals, unlock 8-student hostel group deals, purchase staff-approved kitchen surplus at progressive discounts, and pick up hot food at Counter 2.
          </p>

          {/* LoopAI Quick Suggestion Chips */}
          <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-[#22C55E]" />
              Ask LoopAI:
            </span>
            <button
              onClick={() => onOpenAIWithPrompt('Find a vegetarian lunch under ₹60')}
              className="bg-[#0B1220] hover:bg-[#162238] text-slate-200 border border-slate-700 px-3 py-1 rounded-lg text-xs font-medium transition-colors"
            >
              🥗 Veg under ₹60
            </button>
            <button
              onClick={() => onOpenAIWithPrompt('Show active group deals')}
              className="bg-[#0B1220] hover:bg-[#162238] text-slate-200 border border-slate-700 px-3 py-1 rounded-lg text-xs font-medium transition-colors"
            >
              🥘 Group deals near unlock
            </button>
            <button
              onClick={() => onOpenAIWithPrompt('Check rescue counter surplus')}
              className="bg-[#0B1220] hover:bg-[#162238] text-slate-200 border border-slate-700 px-3 py-1 rounded-lg text-xs font-medium transition-colors"
            >
              ⚡ Rescue meals surplus
            </button>
          </div>
        </div>

        {/* Membership Callout */}
        {currentUser.hasActiveMembership && (
          <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <Award className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-bold text-emerald-400">
                  30-Day Student Membership Active
                </span>
                <span className="text-slate-400 text-[11px] ml-2">
                  10% automatic savings applied at checkout
                </span>
              </div>
            </div>
            <span className="text-slate-400 text-[11px] font-mono">
              Total Saved: ₹{currentUser.membershipSavingsPaise / 100}
            </span>
          </div>
        )}
      </section>

      {/* 2. Group Deals Section (Threshold 8/8) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-[#22C55E]" />
              Hostel 8-Person Group Deals
            </h2>
            <p className="text-xs text-slate-400">
              Free commitment to join. Group price unlocks at 8 hostel mates; payment is required afterward to confirm your meal.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groupDeals.map((deal) => {
            const hasJoined = deal.participantIds.includes(currentUser.id);
            const isUnlocked = deal.status === 'UNLOCKED';
            const progressPercent = Math.min(100, (deal.currentParticipants / deal.targetParticipants) * 100);

            return (
              <div
                key={deal.id}
                className={`bg-[#111B2E] border rounded-2xl p-5 shadow-lg transition-all ${
                  isUnlocked
                    ? 'border-amber-500/60 ring-1 ring-amber-500/30'
                    : 'border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl" aria-hidden="true">{deal.imageEmoji}</span>
                    <div>
                      <h3 className="text-sm font-bold text-white">{deal.title}</h3>
                      <div className="text-xs text-slate-400 mt-0.5">
                        <span>{deal.foodItemName}</span>
                        <span aria-hidden="true"> · </span>
                        <span>{deal.pickupSlot}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-bold text-[#22C55E] font-mono tabular-nums">
                      ₹{deal.groupPricePaise / 100}
                    </div>
                    <div className="text-[11px] text-slate-500 line-through font-mono tabular-nums">
                      Regular ₹{deal.regularPricePaise / 100}
                    </div>
                  </div>
                </div>

                {/* Progress Bar & Status */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">
                      {isUnlocked ? (
                        <span className="text-amber-400 font-bold">🎉 DEAL UNLOCKED (8/8 Joined)</span>
                      ) : (
                        <span>{deal.currentParticipants} of {deal.targetParticipants} hostel mates joined</span>
                      )}
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      {isUnlocked ? 'Checkout open at group price' : `Needs ${deal.targetParticipants - deal.currentParticipants} more`}
                    </span>
                  </div>

                  <div className="w-full bg-[#162238] rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        isUnlocked ? 'bg-amber-400' : 'bg-[#22C55E]'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Actions Bar */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
                  <button
                    onClick={() => handleCopyShareLink(deal.id)}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
                    title="Copy hostel WhatsApp share link"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>{copiedDealId === deal.id ? 'Copied Link!' : 'Share Deal'}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {/* Demo Button: Simulate peer join */}
                    {!isUnlocked && (
                      <button
                        onClick={() => onSimulatePeerJoin(deal.id)}
                        className="text-[11px] bg-[#162238] hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg border border-slate-700 transition-colors"
                        title="Simulate hostel peer commitment"
                      >
                        +1 Peer (Demo)
                      </button>
                    )}

                    {isUnlocked ? (
                      <button
                        onClick={() => {
                          const matchingFood = foodItems.find((f) => f.id === deal.foodItemId) || {
                            id: deal.foodItemId,
                            canteenId: 'sac-canteen-01',
                            name: deal.foodItemName,
                            category: 'Group Deals',
                            pricePaise: deal.groupPricePaise,
                            isVeg: true,
                            description: `Hostel Group Deal: ${deal.title}`,
                            ingredients: [],
                            allergens: [],
                            stockAvailable: 10,
                            imageEmoji: deal.imageEmoji,
                            prepTimeMins: 8,
                          };
                          onAddToCart({
                            ...matchingFood,
                            pricePaise: deal.groupPricePaise,
                          });
                        }}
                        className="bg-amber-400 hover:bg-amber-300 text-[#0B1220] px-4 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow"
                      >
                        Add to Cart @ ₹{deal.groupPricePaise / 100}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : hasJoined ? (
                      <div className="flex items-center gap-1 text-xs text-emerald-400 font-semibold px-3 py-1.5 bg-emerald-500/10 rounded-xl border border-emerald-500/30">
                        <Check className="w-3.5 h-3.5" />
                        <span>You Joined</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => onJoinGroupDeal(deal.id)}
                        className="bg-[#22C55E] hover:bg-[#1ea34d] text-[#0B1220] px-4 py-1.5 rounded-xl text-xs font-bold transition-colors"
                      >
                        Join Free Commitment
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Progressive Rescue Counter Section */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Flame className="w-5 h-5 text-[#FB923C]" />
              Progressive Kitchen Rescue Surplus
            </h2>
            <p className="text-xs text-slate-400">
              Freshly prepped surplus approved by Canteen Chef. Discounts increase as the collection cutoff nears.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 bg-[#111B2E] border border-slate-800 px-3 py-1.5 rounded-xl">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Virtual Clock: +{demoClockOffsetHours}h</span>
            <button
              onClick={() => onAdvanceClock(1)}
              className="ml-1 text-[11px] text-[#22C55E] hover:underline font-semibold"
            >
              +1h
            </button>
          </div>
        </div>

        {rescueBatches.length === 0 ? (
          <div className="bg-[#111B2E] border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400">
            No surplus food currently in rescue. All lunch batches were collected on schedule!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rescueBatches.map((batch) => {
              const qtyInCart = getRescueCartQuantity(batch.id);
              const isAvailable = batch.status === 'AVAILABLE' && batch.quantityAvailable > 0;

              return (
                <div
                  key={batch.id}
                  className="bg-[#111B2E] border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <span className="text-2xl" aria-hidden="true">{batch.imageEmoji}</span>
                      <div>
                        <h3 className="text-xs font-bold text-white">{batch.foodItemName}</h3>
                        <div className="text-[11px] text-[#FB923C] font-semibold mt-0.5">
                          {batch.currentDiscountPercent}% OFF · Rescue Batch
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-bold text-white font-mono tabular-nums">
                        ₹{batch.currentPricePaise / 100}
                      </div>
                      <div className="text-[10px] text-slate-500 line-through font-mono tabular-nums">
                        ₹{batch.originalPricePaise / 100}
                      </div>
                    </div>
                  </div>

                  {/* Stock & Storage Info */}
                  <div className="text-[11px] text-slate-300 space-y-1 bg-[#162238] p-2.5 rounded-xl border border-slate-700/60">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Remaining:</span>
                      <span className="font-semibold text-white">{batch.quantityAvailable} portion(s)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Sale Cutoff:</span>
                      <span className="font-semibold text-amber-300">{batch.saleCutoff} Today</span>
                    </div>
                    <div className="text-slate-400 text-[10px] pt-0.5 border-t border-slate-700">
                      Storage: {batch.handlingInfo}
                    </div>
                  </div>

                  {/* Add Rescue Button */}
                  <div className="pt-1">
                    {isAvailable ? (
                      <button
                        onClick={() => onAddRescueToCart(batch)}
                        className="w-full bg-[#FB923C] hover:bg-[#ea832b] text-[#0B1220] py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Rescue for ₹{batch.currentPricePaise / 100} {qtyInCart > 0 && `(${qtyInCart} in cart)`}</span>
                      </button>
                    ) : (
                      <div className="w-full bg-slate-800 text-slate-500 text-center py-2 rounded-xl text-xs font-medium">
                        Sold Out or Cutoff Reached
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. Regular Canteen Menu with Category & Budget Filters */}
      <section className="space-y-6">
        
        {/* Header & Controls */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">Daily Canteen Menu</h2>
              <p className="text-xs text-slate-400">
                Freshly cooked student meals prepped to order for Counter 2 pickup.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search thali, dosa, chai..."
                className="w-full bg-[#111B2E] border border-slate-800 text-white rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-[#22C55E]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Category Tabs & Quick Toggles */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {/* Category Segmented Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#111B2E] border border-slate-800 rounded-xl">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    selectedCategory === cat
                      ? 'bg-[#22C55E] text-[#0B1220] font-bold shadow-sm'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Budget & Diet Quick Toggles */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Veg Toggle */}
              <button
                onClick={() => setVegOnly(!vegOnly)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                  vegOnly
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-bold'
                    : 'bg-[#111B2E] text-slate-300 border-slate-800 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Pure Veg
              </button>

              {/* Budget Under ₹60 */}
              <button
                onClick={() => setBudgetLimit(budgetLimit === 6000 ? null : 6000)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                  budgetLimit === 6000
                    ? 'bg-[#22C55E] text-[#0B1220] border-[#22C55E] font-bold'
                    : 'bg-[#111B2E] text-slate-300 border-slate-800 hover:text-white'
                }`}
              >
                Under ₹60
              </button>

              {/* In-Stock Toggle */}
              <button
                onClick={() => setInStockOnly(!inStockOnly)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                  inStockOnly
                    ? 'bg-slate-700 text-white border-slate-600 font-bold'
                    : 'bg-[#111B2E] text-slate-300 border-slate-800 hover:text-white'
                }`}
              >
                In Stock Only
              </button>
            </div>
          </div>
        </div>

        {/* Food Items Grid */}
        {filteredFoodItems.length === 0 ? (
          <div className="bg-[#111B2E] border border-slate-800 rounded-2xl p-12 text-center space-y-3">
            <span className="text-3xl block" aria-hidden="true">🔍</span>
            <h3 className="text-sm font-semibold text-white">No menu items match your filters</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Try adjusting your category selection, removing budget limits, or clearing the search query.
            </p>
            <button
              onClick={resetAllFilters}
              className="bg-[#22C55E] hover:bg-[#1ea34d] text-[#0B1220] px-4 py-2 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredFoodItems.map((item) => {
              const qtyInCart = getCartQuantity(item.id);
              const isAvailable = item.stockAvailable > 0;

              return (
                <div
                  key={item.id}
                  className="bg-[#111B2E] border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition-all flex flex-col justify-between"
                >
                  {/* Top: Icon, Title, Category */}
                  <div className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-3xl" aria-hidden="true">{item.imageEmoji}</span>
                        <div>
                          <h3
                            onClick={() => onSelectFoodDetail(item)}
                            className="text-sm font-bold text-white hover:text-[#22C55E] cursor-pointer transition-colors"
                          >
                            {item.name}
                          </h3>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span>{item.category}</span>
                            <span aria-hidden="true">·</span>
                            <span className={item.isVeg ? 'text-emerald-400' : 'text-rose-400'}>
                              {item.isVeg ? 'Veg' : 'Non-Veg'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{item.prepTimeMins}m prep</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-bold text-white font-mono tabular-nums block">
                          ₹{item.pricePaise / 100}
                        </span>
                        {currentUser.hasActiveMembership && (
                          <span className="text-[10px] text-emerald-400 font-mono tabular-nums block">
                            ₹{(item.pricePaise * 0.9) / 100} with Pass
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>

                    {/* Allergens or Key Ingredients */}
                    {item.allergens.length > 0 && (
                      <div className="text-[10px] text-slate-500">
                        Contains: {item.allergens.join(', ')}
                      </div>
                    )}
                  </div>

                  {/* Bottom: Stock & Add to Cart Controls */}
                  <div className="px-4 py-3 bg-[#162238]/60 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400">
                      {isAvailable ? (
                        <span>Stock: <strong className="text-white font-mono">{item.stockAvailable}</strong> left</span>
                      ) : (
                        <span className="text-red-400 font-medium">Sold Out</span>
                      )}
                    </span>

                    {isAvailable ? (
                      qtyInCart > 0 ? (
                        <div className="flex items-center gap-2 bg-[#0B1220] px-2 py-1 rounded-xl border border-slate-700">
                          <button
                            onClick={() => onAddToCart(item, -1)}
                            className="p-0.5 text-slate-300 hover:text-white"
                            aria-label={`Decrease ${item.name}`}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-mono font-bold text-white min-w-[16px] text-center">
                            {qtyInCart}
                          </span>
                          <button
                            onClick={() => onAddToCart(item, 1)}
                            className="p-0.5 text-slate-300 hover:text-white"
                            aria-label={`Increase ${item.name}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onAddToCart(item)}
                          className="bg-[#22C55E] hover:bg-[#1ea34d] text-[#0B1220] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shadow-sm"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </button>
                      )
                    ) : (
                      <button
                        disabled
                        className="bg-slate-800 text-slate-500 px-3 py-1.5 rounded-xl text-xs font-medium cursor-not-allowed"
                      >
                        Unavailable
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
};
