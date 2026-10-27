'use client';

/**
 * @file components/product/FitFinderQuizModal.tsx
 * @description Interactive 3-step shoe fit finder quiz for OX Shoes Pakistan.
 * Recommends optimal shoe size and style fit based on occasion, foot width, and activity.
 * Strict TypeScript: ZERO `any`.
 */

import React, { useState } from 'react';
import { X, Sparkles, Check, ArrowRight, ArrowLeft, RotateCcw } from 'lucide-react';

interface FitFinderQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSize?: (size: number) => void;
}

export function FitFinderQuizModal({ isOpen, onClose, onSelectSize }: FitFinderQuizModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [occasion, setOccasion] = useState<string>('traditional');
  const [width, setWidth] = useState<'standard' | 'wide' | 'narrow'>('standard');
  const [baseSize, setBaseSize] = useState<number>(42);

  if (!isOpen) return null;

  // Fit algorithm
  const calculateRecommendation = () => {
    let size = baseSize;
    let tip = 'True to standard size. Perfect comfort fit.';

    if (occasion === 'traditional' && width === 'wide') {
      tip = 'Traditional pure leather chappals mold over time, but for wide feet 1 size up offers immediate ease.';
      size = Math.min(46, baseSize + 1);
    } else if (occasion === 'formal' && width === 'narrow') {
      tip = 'Dress Oxfords fit snug. Standard EU sizing matches your foot precisely.';
    } else if (occasion === 'sneakers' && width === 'wide') {
      size = Math.min(46, baseSize + 0.5);
      tip = 'Athletic padding requires slight breathing room for all-day cushioning.';
    }

    return { size, tip };
  };

  const recommendation = calculateRecommendation();

  const handleApply = () => {
    if (onSelectSize) {
      onSelectSize(Math.round(recommendation.size));
    }
    onClose();
  };

  const handleReset = () => {
    setStep(1);
    setOccasion('traditional');
    setWidth('standard');
    setBaseSize(42);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quiz-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-lg w-full p-6 text-white shadow-2xl relative font-sans">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-400 text-neutral-950">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h2 id="quiz-modal-title" className="text-base font-black tracking-tight">
                30-Second Fit Finder
              </h2>
              <p className="text-xs text-neutral-400">
                Step {step} of 3 • Personalized Pakistani sizing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step 1: Occasion */}
        {step === 1 && (
          <div className="py-5 space-y-4">
            <h3 className="text-sm font-bold text-neutral-200">
              1. What is the primary occasion you are buying for?
            </h3>
            <div className="space-y-2.5">
              {[
                { id: 'traditional', label: 'Festive / Shalwar Kameez (Peshawari, Khussa, Chappal)' },
                { id: 'formal', label: 'Office, Suits & Corporate Events (Oxfords, Derby, Monks)' },
                { id: 'sneakers', label: 'Daily Wear, Walking & Gym (Sneakers, Trainers, Joggers)' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setOccasion(opt.id)}
                  className={`w-full text-left p-3.5 rounded-2xl border text-xs font-semibold transition-all flex items-center justify-between ${
                    occasion === opt.id
                      ? 'border-amber-400 bg-amber-400/10 text-amber-300'
                      : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700 text-neutral-300'
                  }`}
                >
                  <span>{opt.label}</span>
                  {occasion === opt.id && <Check className="h-4 w-4 text-amber-400" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Foot Width */}
        {step === 2 && (
          <div className="py-5 space-y-4">
            <h3 className="text-sm font-bold text-neutral-200">
              2. How would you describe your foot width?
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'narrow', label: 'Narrow', desc: 'Shoes often slip at the sides' },
                { id: 'standard', label: 'Standard', desc: 'Most shoes fit comfortably' },
                { id: 'wide', label: 'Broad / Wide', desc: 'Shoes pinch across the toes' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setWidth(opt.id as 'narrow' | 'standard' | 'wide')}
                  className={`p-3.5 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                    width === opt.id
                      ? 'border-amber-400 bg-amber-400/10 text-amber-300'
                      : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700 text-neutral-400'
                  }`}
                >
                  <span className="text-xs font-bold text-white">{opt.label}</span>
                  <span className="text-[10px] text-neutral-400 leading-tight">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Base Size */}
        {step === 3 && (
          <div className="py-5 space-y-4">
            <h3 className="text-sm font-bold text-neutral-200">
              3. What is your typical Pakistani / EU shoe number?
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {[39, 40, 41, 42, 43, 44, 45, 46].map((sz) => (
                <button
                  key={sz}
                  onClick={() => setBaseSize(sz)}
                  className={`py-3 rounded-xl border text-sm font-black font-mono transition-all ${
                    baseSize === sz
                      ? 'border-amber-400 bg-amber-400 text-neutral-950'
                      : 'border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Result */}
        {step === 4 && (
          <div className="py-5 space-y-4 text-center">
            <div className="inline-flex p-3 rounded-full bg-amber-400/10 text-amber-400 mb-1">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-neutral-400 uppercase font-black tracking-widest block">
                Recommended Pakistani Size
              </span>
              <div className="text-5xl font-black text-amber-400 font-mono my-2">
                EU / PK {Math.round(recommendation.size)}
              </div>
              <p className="text-xs text-neutral-300 max-w-sm mx-auto bg-neutral-950 p-3 rounded-xl border border-neutral-800">
                {recommendation.tip}
              </p>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
          {step > 1 && step < 4 ? (
            <button
              onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
              className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white text-xs font-bold flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </button>
          ) : step === 4 ? (
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white text-xs font-bold flex items-center gap-1"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Retake Quiz</span>
            </button>
          ) : (
            <div />
          )}

          {step < 3 && (
            <button
              onClick={() => setStep((s) => (s + 1) as 2 | 3)}
              className="px-5 py-2.5 rounded-full bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs uppercase tracking-wider flex items-center gap-1"
            >
              <span>Next</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          )}

          {step === 3 && (
            <button
              onClick={() => setStep(4)}
              className="px-5 py-2.5 rounded-full bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs uppercase tracking-wider flex items-center gap-1"
            >
              <span>See My Fit</span>
              <Sparkles className="h-4 w-4" />
            </button>
          )}

          {step === 4 && (
            <button
              onClick={handleApply}
              className="px-6 py-2.5 rounded-full bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5"
            >
              <Check className="h-4 w-4" />
              <span>Select Size {Math.round(recommendation.size)}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
