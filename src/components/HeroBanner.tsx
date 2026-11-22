import React, { useState } from 'react';
import { DashboardId } from '../types';
import { Sparkles, ArrowRight, Search } from 'lucide-react';

interface HeroBannerProps {
  dashboardId: DashboardId;
  tag?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: string;
  description?: string;
  bottomPills?: {
    icon?: React.ReactNode;
    label: string;
    active?: boolean;
    onClick?: () => void;
  }[];
  primaryCta?: {
    label: string;
    onClick: () => void;
  };
  rightWidget?: React.ReactNode;
  askAiWidget?: {
    placeholder: string;
    chips: string[];
    onAsk: (prompt: string) => void;
  };
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  dashboardId,
  tag,
  title,
  subtitle,
  description,
  bottomPills,
  primaryCta,
  rightWidget,
  askAiWidget,
}) => {
  const [aiQuery, setAiQuery] = useState('');

  const handleAiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim() || !askAiWidget) return;
    askAiWidget.onAsk(aiQuery.trim());
    setAiQuery('');
  };

  return (
    <div className="relative rounded-xl overflow-hidden bg-slate-900 text-white shadow-card border border-slate-800 mb-4">
      {/* Background Subtle Gradient & Artwork */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-luminosity pointer-events-none"
        style={{
          backgroundImage: `url('./assets/crops/hero-art-${dashboardId}.webp'), url('./assets/crops/hero-skyline-art.webp')`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/95 to-slate-900/90 pointer-events-none" />

      <div className="relative z-10 p-5 lg:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          {/* Left Hero Copy */}
          <div className="max-w-2xl">
            {tag && (
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-300 mb-1.5">
                {tag}
              </div>
            )}
            <h1 className="text-2xl lg:text-[28px] font-bold tracking-tight leading-snug text-white">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm lg:text-base font-medium text-slate-300 mt-1">
                {subtitle}
              </p>
            )}
            {description && (
              <p className="text-xs lg:text-sm text-slate-300/80 mt-1.5 max-w-xl leading-relaxed">
                {description}
              </p>
            )}
          </div>

          {/* Right Widget or Ask MyArea AI Box */}
          {askAiWidget ? (
            <div className="w-full lg:w-[350px] shrink-0 bg-slate-800/80 rounded-xl p-3.5 border border-slate-700 shadow-sm">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-600/30 border border-blue-400/30 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-blue-300" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white leading-tight">Ask MyArea AI</p>
                  <p className="text-[10px] text-slate-400">Instant answers about your neighborhood</p>
                </div>
              </div>
              <form onSubmit={handleAiSubmit} className="relative flex items-center mb-2.5">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5" />
                <input
                  type="text"
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  placeholder={askAiWidget.placeholder}
                  className="w-full bg-white text-slate-800 placeholder:text-slate-400 text-xs rounded-lg pl-8 pr-8 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs"
                />
                <button
                  type="submit"
                  className="absolute right-1 w-6 h-6 rounded-md bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
              <div className="flex flex-wrap gap-1">
                {askAiWidget.chips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => askAiWidget.onAsk(chip)}
                    className="px-2 py-0.5 rounded-md bg-slate-700/60 hover:bg-slate-700 border border-slate-600/60 text-[10px] font-medium text-slate-200 transition cursor-pointer"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            rightWidget && <div className="shrink-0">{rightWidget}</div>
          )}
        </div>

        {/* Bottom Interactive Pills / Tabs inside Hero */}
        {(bottomPills || primaryCta) && (
          <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {bottomPills?.map((pill, idx) =>
                pill.onClick ? (
                  <button
                    key={idx}
                    type="button"
                    onClick={pill.onClick}
                    className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                      pill.active
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                    }`}
                  >
                    {pill.icon}
                    <span>{pill.label}</span>
                  </button>
                ) : (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-slate-800/80 text-slate-300 border border-slate-700 select-none"
                  >
                    {pill.icon}
                    <span>{pill.label}</span>
                  </span>
                )
              )}
            </div>
            {primaryCta && (
              <button
                type="button"
                onClick={primaryCta.onClick}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{primaryCta.label}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
