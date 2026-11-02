import React, { useState } from 'react';
import { X, Clock, ShieldCheck, AlertTriangle, Plus, Check } from 'lucide-react';
import { FoodItem } from '../types';

interface MealDetailModalProps {
  item: FoodItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (item: FoodItem, customOptions?: any) => void;
}

export const MealDetailModal: React.FC<MealDetailModalProps> = ({
  item,
  isOpen,
  onClose,
  onAddToCart,
}) => {
  if (!isOpen || !item) return null;

  const [selectedCustomOptions, setSelectedCustomOptions] = useState<{ [groupTitle: string]: { optionName: string; pricePaise: number } }>({});

  const calculateFinalPricePaise = () => {
    let total = item.pricePaise;
    Object.values(selectedCustomOptions).forEach((opt) => {
      total += opt.pricePaise;
    });
    return total;
  };

  const handleAdd = () => {
    const customList = Object.entries(selectedCustomOptions).map(([groupTitle, val]) => ({
      groupTitle,
      optionName: val.optionName,
      pricePaise: val.pricePaise,
    }));
    onAddToCart(item, customList.length > 0 ? customList : undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-[#111B2E] border border-slate-700/80 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden text-slate-100 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-[#162238]">
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 border-2 rounded-xs flex items-center justify-center p-0.5 ${
                item.isVeg ? 'border-emerald-500' : 'border-red-500'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  item.isVeg ? 'bg-emerald-500' : 'bg-red-500'
                }`}
              />
            </span>
            <span className="text-xs uppercase font-bold text-slate-400">
              {item.category}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 rounded-3xl bg-[#162238] flex items-center justify-center text-5xl shadow-inner shrink-0">
              {item.imageEmoji}
            </div>
            <div>
              <h2 className="text-xl font-black text-white">{item.name}</h2>
              <span className="text-lg font-black text-[#22C55E] font-mono mt-0.5 block">
                ₹{item.pricePaise / 100}
              </span>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Prep: {item.prepTimeMins} mins · Central Canteen</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            {item.description}
          </p>

          {/* Ingredients Breakdown */}
          {item.ingredients && item.ingredients.length > 0 && (
            <div className="bg-[#162238] p-4 rounded-2xl border border-slate-700/80 space-y-2">
              <span className="text-xs font-bold text-white block">Declared Ingredients</span>
              <div className="flex flex-wrap gap-1.5">
                {item.ingredients.map((ing, idx) => (
                  <span
                    key={idx}
                    className="bg-[#0B1220] border border-slate-700 text-slate-300 px-2.5 py-1 rounded-lg text-[11px]"
                  >
                    {ing}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Declared Allergens */}
          {item.allergens && item.allergens.length > 0 ? (
            <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-2xl space-y-1 text-xs text-amber-300">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Kitchen Allergen Declaration:</span>
              </div>
              <p className="text-[11px] text-amber-200/90">
                Contains: {item.allergens.join(', ')}. Please inform staff at Counter 2 if you have severe sensitivities.
              </p>
            </div>
          ) : (
            <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-2xl text-xs text-emerald-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span>No major allergens declared in this meal.</span>
            </div>
          )}

          {/* Customisation Groups */}
          {item.customisations && item.customisations.map((group) => (
            <div key={group.title} className="space-y-2 pt-1">
              <span className="text-xs font-bold text-white block uppercase tracking-wider">
                {group.title}
              </span>
              <div className="space-y-1.5">
                {group.options.map((opt) => {
                  const isChecked = selectedCustomOptions[group.title]?.optionName === opt.name;
                  return (
                    <div
                      key={opt.name}
                      onClick={() => {
                        setSelectedCustomOptions((prev) => ({
                          ...prev,
                          [group.title]: { optionName: opt.name, pricePaise: opt.pricePaise },
                        }));
                      }}
                      className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between text-xs transition-colors ${
                        isChecked
                          ? 'bg-[#22C55E]/15 border-[#22C55E] text-white'
                          : 'bg-[#162238] border-slate-700 text-slate-300 hover:bg-[#1E2D4A]'
                      }`}
                    >
                      <span>{opt.name}</span>
                      <span className="font-mono font-bold">
                        {opt.pricePaise > 0 ? `+₹${opt.pricePaise / 100}` : 'Included'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-[#162238] flex items-center justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Price</span>
            <span className="text-base font-black text-white font-mono">
              ₹{calculateFinalPricePaise() / 100}
            </span>
          </div>

          <button
            onClick={handleAdd}
            className="bg-[#22C55E] hover:bg-green-600 text-[#0B1220] px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-transform active:scale-95"
          >
            Add to Order
          </button>
        </div>

      </div>
    </div>
  );
};
