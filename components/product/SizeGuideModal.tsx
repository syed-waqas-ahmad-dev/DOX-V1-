'use client';

/**
 * @file components/product/SizeGuideModal.tsx
 * @description Enterprise footwear sizing modal for Pakistani shoppers.
 * Features Pakistan/EU, UK, US, and foot measurement conversions (cm & inches),
 * plus category-specific fit tips (Peshawari Chappal, Khussa, Oxford Formals, Sneakers).
 * Strict TypeScript: ZERO `any`.
 */

import React, { useState } from 'react';
import { X, Ruler, HelpCircle, Check, Info } from 'lucide-react';

interface SizeGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  category?: string;
}

interface SizeRow {
  pkEu: string;
  uk: string;
  us: string;
  cm: string;
  inches: string;
}

const MEN_SIZE_CHART: SizeRow[] = [
  { pkEu: '39', uk: '5.5', us: '6.5', cm: '24.5', inches: '9.6' },
  { pkEu: '40', uk: '6.0', us: '7.0', cm: '25.0', inches: '9.8' },
  { pkEu: '41', uk: '7.0', us: '8.0', cm: '26.0', inches: '10.2' },
  { pkEu: '42', uk: '8.0', us: '9.0', cm: '27.0', inches: '10.6' },
  { pkEu: '43', uk: '9.0', us: '10.0', cm: '27.5', inches: '10.8' },
  { pkEu: '44', uk: '10.0', us: '11.0', cm: '28.5', inches: '11.2' },
  { pkEu: '45', uk: '11.0', us: '12.0', cm: '29.5', inches: '11.6' },
];

const WOMEN_SIZE_CHART: SizeRow[] = [
  { pkEu: '36', uk: '3.0', us: '5.0', cm: '22.5', inches: '8.8' },
  { pkEu: '37', uk: '4.0', us: '6.0', cm: '23.5', inches: '9.2' },
  { pkEu: '38', uk: '5.0', us: '7.0', cm: '24.0', inches: '9.4' },
  { pkEu: '39', uk: '6.0', us: '8.0', cm: '25.0', inches: '9.8' },
  { pkEu: '40', uk: '7.0', us: '9.0', cm: '25.5', inches: '10.0' },
  { pkEu: '41', uk: '8.0', us: '10.0', cm: '26.5', inches: '10.4' },
];

export function SizeGuideModal({ isOpen, onClose, category }: SizeGuideModalProps) {
  const [activeGender, setActiveGender] = useState<'men' | 'women'>(
    category?.toLowerCase().includes('women') ? 'women' : 'men'
  );
  const [measurementUnit, setMeasurementUnit] = useState<'cm' | 'inches'>('cm');

  if (!isOpen) return null;

  const currentChart = activeGender === 'men' ? MEN_SIZE_CHART : WOMEN_SIZE_CHART;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="size-guide-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-2xl w-full p-6 text-white shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-400/10 text-amber-400">
              <Ruler className="h-5 w-5" />
            </div>
            <div>
              <h2 id="size-guide-title" className="text-lg font-black tracking-tight">
                Pakistani Footwear Size Guide
              </h2>
              <p className="text-xs text-neutral-400">
                UK, EU/Pakistan & foot measurement conversions
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

        {/* Gender and Unit Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-3 my-4">
          <div className="inline-flex rounded-xl bg-neutral-800/80 p-1 border border-neutral-700/60">
            <button
              onClick={() => setActiveGender('men')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeGender === 'men'
                  ? 'bg-amber-400 text-neutral-950 shadow-sm'
                  : 'text-neutral-300 hover:text-white'
              }`}
            >
              Men / Boys
            </button>
            <button
              onClick={() => setActiveGender('women')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeGender === 'women'
                  ? 'bg-amber-400 text-neutral-950 shadow-sm'
                  : 'text-neutral-300 hover:text-white'
              }`}
            >
              Women / Girls
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-neutral-400">Measurement:</span>
            <div className="inline-flex rounded-lg bg-neutral-800 p-0.5 border border-neutral-700">
              <button
                onClick={() => setMeasurementUnit('cm')}
                className={`px-2.5 py-1 rounded text-xs font-bold ${
                  measurementUnit === 'cm' ? 'bg-neutral-700 text-white' : 'text-neutral-400'
                }`}
              >
                CM
              </button>
              <button
                onClick={() => setMeasurementUnit('inches')}
                className={`px-2.5 py-1 rounded text-xs font-bold ${
                  measurementUnit === 'inches' ? 'bg-neutral-700 text-white' : 'text-neutral-400'
                }`}
              >
                Inches
              </button>
            </div>
          </div>
        </div>

        {/* Sizing Table */}
        <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-neutral-950">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/50 text-neutral-400">
                <th className="py-3 px-4 font-bold text-amber-400">Pakistan / EU</th>
                <th className="py-3 px-4 font-bold">UK Standard</th>
                <th className="py-3 px-4 font-bold">US Size</th>
                <th className="py-3 px-4 font-bold text-right">
                  Foot Length ({measurementUnit.toUpperCase()})
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {currentChart.map((row) => (
                <tr key={row.pkEu} className="hover:bg-neutral-900/30 transition-colors">
                  <td className="py-2.5 px-4 font-black font-mono text-white text-sm">
                    {row.pkEu}
                  </td>
                  <td className="py-2.5 px-4 font-medium text-neutral-300">{row.uk}</td>
                  <td className="py-2.5 px-4 font-medium text-neutral-300">{row.us}</td>
                  <td className="py-2.5 px-4 font-mono font-bold text-right text-amber-300">
                    {measurementUnit === 'cm' ? `${row.cm} cm` : `${row.inches}″`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Traditional & Formal Shoes Fit Tips */}
        <div className="mt-4 p-4 rounded-2xl bg-amber-950/20 border border-amber-900/40 text-xs text-neutral-300 space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-amber-400">
            <Info className="h-4 w-4" />
            <span>Pakistani Fitting Guide & Tips</span>
          </div>
          <ul className="space-y-1.5 text-[11px] text-neutral-400 list-disc list-inside">
            <li>
              <strong className="text-white">Peshawari & Nowsheri Chappal:</strong> Pure leather chappals stretch naturally ~0.5 size after 2-3 wears. If between sizes, order your exact normal sneaker size.
            </li>
            <li>
              <strong className="text-white">Khussa:</strong> Traditional Khussas are unpadded initially. If you have broad feet, we suggest choosing 1 size up for day-long comfort.
            </li>
            <li>
              <strong className="text-white">Formal Oxfords / Brogues:</strong> True to European sizing. Order your standard Pakistani dress shoe number.
            </li>
          </ul>
        </div>

        {/* How to measure foot */}
        <div className="mt-4 p-4 rounded-2xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-400 flex items-start gap-3">
          <HelpCircle className="h-5 w-5 text-neutral-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-white block">How to measure your foot length at home:</span>
            <p className="text-[11px]">
              Place a piece of paper on a hard floor against a flat wall. Stand upright with your heel touching the wall. Mark the longest part of your foot (tip of the big toe) with a pencil. Measure the distance from wall to mark in centimeters.
            </p>
          </div>
        </div>

        {/* Footer / Done */}
        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-full bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5"
          >
            <Check className="h-4 w-4" />
            <span>Got My Size</span>
          </button>
        </div>
      </div>
    </div>
  );
}
