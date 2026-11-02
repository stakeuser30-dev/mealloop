import React, { useState } from 'react';
import { HeartHandshake, CheckCircle2, Clock, MapPin, ShieldCheck, AlertCircle, ArrowRight, X } from 'lucide-react';
import { DonationOffer } from '../types';

interface NgoPortalProps {
  donations: DonationOffer[];
  onAcceptOffer: (id: string) => Promise<void>;
  onDeclineOffer: (id: string) => Promise<void>;
  onConfirmHandover: (id: string) => Promise<void>;
}

export const NgoPortal: React.FC<NgoPortalProps> = ({
  donations,
  onAcceptOffer,
  onDeclineOffer,
  onConfirmHandover,
}) => {
  const [activeTab, setActiveTab] = useState<'available' | 'history'>('available');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const pendingOffers = donations.filter((d) => d.status === 'PENDING_NGO' || d.status === 'ACCEPTED');
  const completedDonations = donations.filter((d) => d.status === 'HANDED_OVER');

  const handleAction = async (action: () => Promise<void>, id: string) => {
    setProcessingId(id);
    try {
      await action();
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* NGO Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-[#111B2E] to-[#0B1220] rounded-3xl p-6 sm:p-8 border border-emerald-500/30 shadow-xl space-y-2">
        <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
          <HeartHandshake className="w-4 h-4" />
          Robin Hood Army · Campus Food Recovery Chapter
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Campus Food Recovery & Donation Dispatch
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
          Direct surplus food recovery from Central Campus Food Court kitchen. Verified handling at safe temperatures. Handover must be completed and logged by volunteers before cutoff.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-4 text-xs font-bold">
        <button
          onClick={() => setActiveTab('available')}
          className={`py-3 border-b-2 transition-colors ${
            activeTab === 'available'
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Active Donation Offers ({pendingOffers.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`py-3 border-b-2 transition-colors ${
            activeTab === 'history'
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Verified Handover History ({completedDonations.length})
        </button>
      </div>

      {/* Active Donation Offers */}
      {activeTab === 'available' && (
        <div className="space-y-4">
          {pendingOffers.length === 0 ? (
            <div className="bg-[#111B2E] rounded-3xl p-12 text-center border border-slate-800 space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <h3 className="text-base font-bold text-white">No Pending Surplus Offers</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                All kitchen surplus has been either claimed or redistributed. The canteen system notifies the NGO team automatically when a cutoff approaches.
              </p>
            </div>
          ) : (
            pendingOffers.map((offer) => {
              const isAccepted = offer.status === 'ACCEPTED';
              return (
                <div
                  key={offer.id}
                  className="bg-[#111B2E] rounded-3xl p-6 border border-emerald-500/40 shadow-xl space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-3xl">{offer.imageEmoji}</span>
                        <div>
                          <h3 className="font-black text-white text-base">
                            {offer.foodItemName}
                          </h3>
                          <span className="text-xs font-mono font-bold text-emerald-400">
                            {offer.portions} Prepared Portions Available
                          </span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-xs font-black uppercase px-3 py-1 rounded-full ${
                        isAccepted
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {isAccepted ? 'Volunteers Dispatched' : 'Action Required'}
                    </span>
                  </div>

                  {/* Handling & Pickup Details Box */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#162238] rounded-2xl p-4 border border-slate-700/80 text-xs">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>Food Quality & Holding Condition:</span>
                      </div>
                      <p className="text-slate-200 font-medium">{offer.handlingInfo}</p>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <MapPin className="w-4 h-4 text-[#FB923C]" />
                        <span>Pickup Location & Cutoff:</span>
                      </div>
                      <p className="text-slate-200 font-medium">{offer.location}</p>
                      <span className="text-[11px] text-amber-400 font-bold block">
                        Must collect by: {offer.pickupCutoff}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <span className="text-xs text-slate-400">
                      Assigned to: <strong>{offer.ngoOrgName}</strong>
                    </span>

                    <div className="flex items-center gap-3">
                      {!isAccepted ? (
                        <>
                          <button
                            onClick={() => handleAction(() => onDeclineOffer(offer.id), offer.id)}
                            disabled={processingId === offer.id}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold transition-colors"
                          >
                            Decline Offer
                          </button>

                          <button
                            onClick={() => handleAction(() => onAcceptOffer(offer.id), offer.id)}
                            disabled={processingId === offer.id}
                            className="bg-[#22C55E] hover:bg-green-600 text-[#0B1220] px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-transform active:scale-95"
                          >
                            {processingId === offer.id ? 'Accepting...' : 'Accept & Dispatch Volunteers →'}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleAction(() => onConfirmHandover(offer.id), offer.id)}
                          disabled={processingId === offer.id}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-transform active:scale-95 flex items-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{processingId === offer.id ? 'Verifying...' : 'Confirm Handover & Receipt'}</span>
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

      {/* History */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {completedDonations.length === 0 ? (
            <div className="bg-[#111B2E] rounded-3xl p-10 text-center border border-slate-800 text-slate-400 text-xs">
              No completed handovers in this session yet.
            </div>
          ) : (
            completedDonations.map((d) => (
              <div key={d.id} className="bg-[#111B2E] p-4 rounded-2xl border border-slate-800 flex justify-between items-center text-xs">
                <div>
                  <h4 className="font-bold text-white text-sm">{d.foodItemName}</h4>
                  <span className="text-slate-400">{d.portions} portions received · Verified by {d.verifiedByStaff}</span>
                </div>
                <span className="bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full font-bold">
                  ✓ Transferred
                </span>
              </div>
            ))
          )}
        </div>
      )}

    </div>
  );
};
