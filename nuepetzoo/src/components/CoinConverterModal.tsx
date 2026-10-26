import React, { useState } from 'react';
import { X, Sparkles, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { COIN_TO_GEM_RATE } from '../types/pet';
import { soundFX } from '../utils/sound';

interface CoinConverterModalProps {
  isOpen: boolean;
  coins: number;
  crystals: number;
  onClose: () => void;
  onConvert: (coinsToConvert: number) => Promise<{ crystalsGained: number } | void>;
}

export const CoinConverterModal: React.FC<CoinConverterModalProps> = ({
  isOpen,
  coins,
  crystals,
  onClose,
  onConvert,
}) => {
  const [selectedCoins, setSelectedCoins] = useState<number>(50000);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const calculatedCrystals = Math.floor(selectedCoins / COIN_TO_GEM_RATE);
  const canAfford = coins >= selectedCoins && selectedCoins >= 10;

  const handleQuickSelect = (amount: number) => {
    soundFX.playUiClick();
    setSelectedCoins(amount);
    setSuccessMsg(null);
    setErrorMsg(null);
  };

  const handleExecuteConvert = async () => {
    if (!canAfford || isSubmitting) return;

    setIsSubmitting(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      soundFX.playCoinClaim();
      const res = await onConvert(selectedCoins);
      const gained = res?.crystalsGained ?? calculatedCrystals;
      setSuccessMsg(
        `Berhasil menukar ${selectedCoins.toLocaleString('id-ID')} Koin menjadi ${gained.toLocaleString('id-ID')} Crystal!`
      );
      setTimeout(() => {
        setSuccessMsg(null);
      }, 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menukar koin. Pastikan koneksi stabil.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 text-amber-950 flex items-center justify-center text-sm font-black shadow-xs">
              🪙
            </span>
            <div>
              <h2 className="font-['Fredoka'] text-lg font-bold text-slate-800 leading-tight">
                Tukar Koin ke Crystal
              </h2>
              <p className="text-[11px] text-slate-500">
                10 Koin = 1 Crystal • 50.000 Koin = 5.000 Crystal
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              soundFX.playUiClick();
              onClose();
            }}
            className="w-8 h-8 rounded-xl bg-slate-200/70 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-4">
          {/* Current Saldo Row */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200/90 flex flex-col">
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                Saldo Koin Game
              </span>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-sm">🪙</span>
                <span className="font-mono tabular-nums text-base sm:text-lg font-black text-amber-950">
                  {coins.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-sky-50/80 border border-sky-200/90 flex flex-col">
              <span className="text-[10px] font-bold text-sky-700 uppercase tracking-wider">
                Saldo Crystal Akun
              </span>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-sm text-sky-500">✦</span>
                <span className="font-mono tabular-nums text-base sm:text-lg font-black text-sky-950">
                  {crystals.toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Select Buttons */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1.5">
              Pilih Nominal Penukaran Koin:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { amount: 10000, label: '10.000 Koin', reward: '1.000 ✦' },
                {
                  amount: 50000,
                  label: '50.000 Koin',
                  reward: '5.000 ✦',
                  badge: 'Populer',
                },
                { amount: 100000, label: '100.000 Koin', reward: '10.000 ✦' },
                {
                  amount: Math.max(10, Math.floor(coins / 10) * 10),
                  label: 'Semua Koin',
                  reward: `${Math.floor(coins / 10).toLocaleString('id-ID')} ✦`,
                },
              ].map((opt, idx) => {
                const isSelected = selectedCoins === opt.amount;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleQuickSelect(opt.amount)}
                    className={`p-2.5 rounded-2xl border text-left transition-all relative ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-400/20'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {opt.badge && (
                      <span className="absolute -top-2 right-2 px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-extrabold text-[8.5px] uppercase">
                        {opt.badge}
                      </span>
                    )}
                    <span className="font-extrabold text-xs text-slate-800 block">
                      {opt.label}
                    </span>
                    <span className="text-[11px] font-bold text-sky-600 mt-0.5 inline-block">
                      Dapat {opt.reward}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conversion Preview Box */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-100/60 via-amber-50 to-sky-100/60 border border-amber-200/70 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-500">
                Kamu Menukar
              </span>
              <span className="font-mono tabular-nums text-sm font-extrabold text-amber-900">
                🪙 {selectedCoins.toLocaleString('id-ID')}
              </span>
            </div>

            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />

            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-slate-500">
                Kamu Menerima
              </span>
              <span className="font-mono tabular-nums text-sm font-extrabold text-sky-700">
                ✦ {calculatedCrystals.toLocaleString('id-ID')} Crystal
              </span>
            </div>
          </div>

          {/* Feedback Alerts */}
          {successMsg && (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!canAfford && (
            <p className="text-[11px] text-rose-600 font-semibold text-center">
              ⚠️ Saldo Koin kamu belum cukup untuk nominal ini. Kumpulkan koin dari pet di pulau!
            </p>
          )}

          {/* Action Button */}
          <button
            type="button"
            disabled={!canAfford || isSubmitting}
            onClick={handleExecuteConvert}
            className={`w-full py-3 px-4 rounded-2xl font-['Fredoka'] text-sm font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] ${
              canAfford && !isSubmitting
                ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-amber-950 shadow-amber-500/25 cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {isSubmitting
                ? 'Sedang Menukar...'
                : `Tukar Sekarang (+${calculatedCrystals.toLocaleString('id-ID')} Crystal)`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
