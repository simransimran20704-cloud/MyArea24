import React from 'react';
import { CheckCircle, Clock, Truck, Package, XCircle, AlertCircle } from 'lucide-react';
import { OrderStatus } from '../types';

export interface OrderTrackerProps {
  status: OrderStatus | string;
  orderNumber?: string;
  orderDate?: string | Date;
  variant?: 'horizontal' | 'vertical' | 'compact';
  notes?: string;
  className?: string;
}

interface StepInfo {
  key: OrderStatus;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STAGES: StepInfo[] = [
  { key: 'placed', label: 'Placed', desc: 'Order received by store', icon: Clock },
  { key: 'confirmed', label: 'Accepted', desc: 'Packed & invoice generated', icon: CheckCircle },
  { key: 'out_for_delivery', label: 'On Way', desc: 'Out for doorstep delivery', icon: Truck },
  { key: 'delivered', label: 'Delivered', desc: 'Handed over safely', icon: Package },
];

const STAGE_INDEX_MAP: Record<string, number> = {
  placed: 0,
  confirmed: 1,
  out_for_delivery: 2,
  delivered: 3,
};

export const OrderTracker: React.FC<OrderTrackerProps> = ({
  status,
  orderNumber,
  orderDate,
  variant = 'horizontal',
  notes,
  className = '',
}) => {
  const isCancelled = status === 'cancelled';
  const currentIdx = isCancelled ? -1 : (STAGE_INDEX_MAP[status] ?? 0);

  if (isCancelled) {
    return (
      <div className={`bg-rose-50/80 border border-rose-200 rounded-2xl p-3.5 flex items-center gap-3 text-xs text-rose-800 ${className}`}>
        <XCircle className="w-5 h-5 shrink-0 text-rose-600" />
        <div>
          <p className="font-extrabold">Order Cancelled</p>
          <p className="text-[11px] text-rose-600 mt-0.5">
            {notes || 'This order was cancelled. Items have been restocked to inventory.'}
          </p>
        </div>
      </div>
    );
  }

  if (variant === 'vertical') {
    return (
      <div className={`space-y-4 relative pl-6 border-l-2 border-slate-200 ml-3 py-1 ${className}`}>
        {STAGES.map((st, idx) => {
          const isDone = idx <= currentIdx;
          const isCurrent = idx === currentIdx;
          const Icon = st.icon;

          return (
            <div key={st.key} className="relative flex items-start justify-between">
              <span
                className={`absolute -left-[31px] top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                  isCurrent
                    ? 'bg-blue-600 text-white ring-4 ring-blue-100 shadow-xs'
                    : isDone
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'bg-white border-2 border-slate-300 text-slate-400'
                }`}
              >
                {isDone ? <CheckCircle className="w-3.5 h-3.5" /> : idx + 1}
              </span>
              <div className="pl-2">
                <p
                  className={`text-xs font-extrabold ${
                    isCurrent ? 'text-blue-600' : isDone ? 'text-slate-900' : 'text-slate-400'
                  }`}
                >
                  {st.label} {isCurrent && <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-full ml-1">● Active</span>}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">{st.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Horizontal variant (default) with responsive progress track
  return (
    <div className={`w-full py-2.5 ${className}`}>
      <div className="flex items-center justify-between relative">
        <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-200 -translate-y-1/2 z-0" />
        <div
          className="absolute top-1/2 left-0 h-1 bg-emerald-500 -translate-y-1/2 z-0 transition-all duration-500"
          style={{ width: `${(Math.max(0, currentIdx) / (STAGES.length - 1)) * 100}%` }}
        />

        {STAGES.map((st, idx) => {
          const isDone = idx <= currentIdx;
          const isCurrent = idx === currentIdx;
          const Icon = st.icon;

          return (
            <div key={st.key} className="flex flex-col items-center relative z-10">
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                  isCurrent
                    ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                    : isDone
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white text-slate-400 border-2 border-slate-300'
                }`}
              >
                {isDone ? <CheckCircle className="w-4 h-4" /> : idx + 1}
              </div>
              <span
                className={`text-[10px] sm:text-[11px] mt-1.5 font-semibold text-center ${
                  isCurrent
                    ? 'text-emerald-700 font-extrabold'
                    : isDone
                    ? 'text-slate-700'
                    : 'text-slate-400'
                }`}
              >
                {st.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
