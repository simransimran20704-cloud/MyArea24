import React from 'react';
import { AlertCircle, ChevronRight, ShieldAlert, Clock, MapPin, Building2 } from 'lucide-react';
import { LiveAlertItem } from '../services/liveIntelligence';
import { ActionModalData } from '../types';

export interface AlertBannerProps {
  alert: LiveAlertItem | {
    id: string;
    title: string;
    description: string;
    category: string;
    severity?: string;
    sender: string;
    timeAgo: string;
    areaDescription?: string;
    instruction?: string;
    badgeClass?: string;
    icon?: string;
  };
  variant?: 'banner' | 'card' | 'compact';
  onClick?: () => void;
  onOpenModal?: (data: ActionModalData) => void;
  className?: string;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  alert: a,
  variant = 'card',
  onClick,
  onOpenModal,
  className = '',
}) => {
  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }
    if (onOpenModal) {
      onOpenModal({
        title: a.title,
        category: `${a.category} • ${a.sender}`,
        badge: a.severity || 'Notice',
        location: a.areaDescription,
        description: `${a.description}${
          a.instruction ? `\n\nRecommended Action: ${a.instruction}` : ''
        }`,
        primaryActionLabel: 'Ask AI About This Notice',
      });
    }
  };

  const isCritical = a.severity === 'Critical' || (a.badgeClass && a.badgeClass.includes('rose'));
  const isImportant = a.severity === 'Important' || (a.badgeClass && a.badgeClass.includes('amber'));

  if (variant === 'compact') {
    return (
      <div
        onClick={handleClick}
        className={`cursor-pointer flex items-center justify-between gap-2.5 p-2 sm:p-2.5 rounded-xl hover:bg-slate-50 border border-slate-200/70 transition bg-white ${className}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold ${
              isCritical
                ? 'bg-rose-100 text-rose-700'
                : isImportant
                ? 'bg-amber-100 text-amber-700'
                : 'bg-blue-100 text-blue-700'
            }`}
          >
            {a.icon || '📢'}
          </div>
          <div className="min-w-0">
            <h5 className="text-xs font-bold text-slate-900 truncate">{a.title}</h5>
            <p className="text-[10px] text-slate-500 truncate mt-0.5">
              {a.sender} • {a.timeAgo}
            </p>
          </div>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </div>
    );
  }

  if (variant === 'banner') {
    return (
      <div
        onClick={handleClick}
        className={`cursor-pointer rounded-2xl p-3 sm:p-4 border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
          isCritical
            ? 'bg-gradient-to-r from-rose-50 to-orange-50 border-rose-200 text-rose-900'
            : isImportant
            ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200 text-amber-900'
            : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 text-blue-900'
        } ${className}`}
      >
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 shadow-2xs ${
              isCritical
                ? 'bg-rose-600 text-white'
                : isImportant
                ? 'bg-amber-500 text-white'
                : 'bg-blue-600 text-white'
            }`}
          >
            {a.icon || '📢'}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider ${
                  a.badgeClass || (isCritical ? 'bg-rose-200 text-rose-800' : 'bg-blue-200 text-blue-800')
                }`}
              >
                {a.category}
              </span>
              <span className="text-[10px] opacity-75">{a.sender} • {a.timeAgo}</span>
            </div>
            <h4 className="text-xs sm:text-sm font-extrabold mt-1">{a.title}</h4>
            <p className="text-[11px] opacity-85 mt-0.5 line-clamp-2">{a.description}</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 opacity-50 shrink-0 self-end sm:self-center" />
      </div>
    );
  }

  // Default 'card' variant
  return (
    <div
      onClick={handleClick}
      className={`cursor-pointer p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 hover:border-blue-400 bg-white hover:bg-slate-50/50 flex items-start justify-between gap-3 transition shadow-xs ${className}`}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-lg shrink-0 shadow-2xs">
          {a.icon || '📢'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                a.badgeClass || (isCritical ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-800')
              }`}
            >
              {a.category}
            </span>
            <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {a.timeAgo}
            </span>
          </div>

          <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 mt-1.5 line-clamp-1">{a.title}</h4>
          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed line-clamp-2">{a.description}</p>

          <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-2">
            {a.areaDescription && (
              <span className="flex items-center gap-1 truncate max-w-[180px]">
                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{a.areaDescription}</span>
              </span>
            )}
            <span className="flex items-center gap-1 truncate">
              <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate">{a.sender}</span>
            </span>
          </div>

          {a.instruction && (
            <p className="text-[10px] font-bold text-indigo-700 mt-2 bg-indigo-50/60 px-2 py-1 rounded-lg">
              ✓ Action: {a.instruction}
            </p>
          )}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-2" />
    </div>
  );
};
