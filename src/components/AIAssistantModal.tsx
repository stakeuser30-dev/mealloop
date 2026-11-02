import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Sparkles, Plus, ArrowRight, ShieldCheck, Check } from 'lucide-react';
import { FoodItem } from '../types';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (item: FoodItem) => void;
  initialPrompt?: string;
}

interface Message {
  sender: 'user' | 'assistant';
  text: string;
  suggestionChips?: string[];
  matchingItems?: FoodItem[];
  proposedCart?: {
    item: FoodItem;
    quantity: number;
    totalPaise: number;
  };
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  isOpen,
  onClose,
  onAddToCart,
  initialPrompt,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'assistant',
      text: 'Hi! I am **LoopAI**, your central canteen assistant. I have live access to current inventory, group deals, progressive rescue discounts, and canteen allergen declarations.\n\nHow can I help you eat well today?',
      suggestionChips: [
        'Find lunch under ₹60.',
        'Show vegetarian rescue meals.',
        'Which group deals are close to unlocking?',
        'Where is my order?',
      ],
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialPrompt && isOpen) {
      sendMessage(initialPrompt);
    }
  }, [initialPrompt, isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  const sendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg: Message = { sender: 'user', text: textToSend };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages((prev) => [
          ...prev,
          {
            sender: 'assistant',
            text: data.reply,
            suggestionChips: data.suggestionChips,
            matchingItems: data.matchingItems,
            proposedCart: data.proposedCart,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: 'I could not connect to the campus assistant service right now. Please try again.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4">
      <div className="bg-[#111B2E] border border-slate-700/80 rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden text-slate-100 flex flex-col h-[650px] max-h-[90vh] animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-[#162238]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#22C55E] to-emerald-600 flex items-center justify-center text-white shadow-md">
              <Bot className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm text-white">LoopAI Campus Assistant</h3>
                <span className="text-[10px] bg-[#22C55E]/20 text-[#22C55E] px-1.5 py-0.2 rounded font-mono font-bold">
                  Live Stock Tools
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Central Campus Food Court · Verified Prices in Paise
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {messages.map((msg, idx) => {
            const isUser = msg.sender === 'user';
            return (
              <div key={idx} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-2`}>
                <div
                  className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed ${
                    isUser
                      ? 'bg-[#22C55E] text-[#0B1220] font-semibold rounded-tr-xs'
                      : 'bg-[#162238] border border-slate-700/80 text-slate-200 rounded-tl-xs space-y-2'
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.text}</p>

                  {/* Matching Items preview cards if provided */}
                  {msg.matchingItems && msg.matchingItems.length > 0 && (
                    <div className="pt-2 space-y-2">
                      {msg.matchingItems.slice(0, 2).map((item) => (
                        <div
                          key={item.id}
                          className="bg-[#0B1220] border border-slate-700 p-2.5 rounded-xl flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{item.imageEmoji}</span>
                            <div>
                              <span className="font-bold text-white block">{item.name}</span>
                              <span className="text-[#22C55E] font-mono font-bold">
                                ₹{item.pricePaise / 100}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              onAddToCart(item);
                              onClose();
                            }}
                            className="bg-[#22C55E] hover:bg-green-600 text-[#0B1220] px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider"
                          >
                            Add to Cart
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Proposed Cart 1-Click Confirmation */}
                  {msg.proposedCart && (
                    <div className="mt-3 p-3 bg-[#0B1220] border border-[#22C55E]/40 rounded-xl flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Proposed Cart</span>
                        <span className="font-bold text-white text-xs">{msg.proposedCart.item.name}</span>
                        <span className="font-mono text-[#22C55E] font-bold text-xs block">
                          ₹{msg.proposedCart.totalPaise / 100}
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          onAddToCart(msg.proposedCart!.item);
                          onClose();
                        }}
                        className="bg-[#22C55E] hover:bg-green-600 text-[#0B1220] px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        Confirm & Add
                      </button>
                    </div>
                  )}
                </div>

                {/* Suggestion Chips */}
                {msg.suggestionChips && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {msg.suggestionChips.map((chip, cIdx) => (
                      <button
                        key={cIdx}
                        onClick={() => sendMessage(chip)}
                        className="bg-[#162238] hover:bg-[#1E2D4A] border border-slate-700/80 text-slate-300 hover:text-white px-3 py-1 rounded-xl text-[11px] font-semibold transition-colors"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-[#162238] p-3 rounded-2xl w-fit">
              <div className="w-2 h-2 rounded-full bg-[#22C55E] animate-ping" />
              <span>Checking canteen database & calculating prices...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(inputText);
          }}
          className="p-3 sm:p-4 border-t border-slate-800 bg-[#162238] flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Ask about meals under ₹60, group deals, allergens..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 bg-[#0B1220] border border-slate-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#22C55E]"
          />
          <button
            type="submit"
            disabled={isLoading || !inputText.trim()}
            className="bg-[#22C55E] hover:bg-green-600 text-[#0B1220] p-2.5 rounded-xl transition-transform active:scale-95 disabled:opacity-50"
          >
            <Send className="w-4 h-4 stroke-[2.5]" />
          </button>
        </form>

      </div>
    </div>
  );
};
