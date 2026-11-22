import React from 'react';
import { Star, Heart, Phone, MapPin, Store, MessageCircle, Clock, CheckCircle2 } from 'lucide-react';
import { LiveBusinessItem } from '../services/communityMarketplaceService';
import { ActionModalData, SavedEntry } from '../types';

export interface BusinessCardProps {
  business: LiveBusinessItem;
  isSaved?: boolean;
  onToggleSave?: (entry: SavedEntry) => void;
  onOpenModal?: (data: ActionModalData) => void;
  className?: string;
}

export const BusinessCard: React.FC<BusinessCardProps> = ({
  business: b,
  isSaved = false,
  onToggleSave,
  onOpenModal,
  className = '',
}) => {
  const handleCardClick = () => {
    if (!onOpenModal) return;
    onOpenModal({
      title: b.name,
      subtitle: b.sub,
      category: b.cat,
      badge: `${b.status} • ${b.closes}`,
      rating: `${b.rating} ${b.reviews}`,
      location: `${b.dist} away • ${b.address}`,
      description: b.description,
      primaryActionLabel: `Call Store (${b.phone || 'Contact'})`,
      image: b.img,
      phone: b.phone,
      whatsapp: b.whatsapp || b.phone,
      address: b.address,
      lat: b.lat,
      lng: b.lng,
      source: b.source,
      verified: b.verified,
      freshnessLabel: b.verified ? 'Verified Neighborhood Merchant' : 'Local Community Store',
    });
  };

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onToggleSave) return;
    onToggleSave({
      id: b.id,
      title: b.name,
      subtitle: b.sub,
      category: 'Businesses',
      meta: b.dist,
      image: b.img,
      savedAt: 'Just now',
    });
  };

  const handlePhoneClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (b.phone) {
      window.location.href = `tel:${b.phone.replace(/[^\d+]/g, '')}`;
    } else {
      handleCardClick();
    }
  };

  const handleWhatsAppClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const phone = (b.whatsapp || b.phone || '').replace(/[^\d]/g, '');
    if (phone) {
      const text = encodeURIComponent(`Hi ${b.name}, I found your shop on MyArea24 and would like to place an order.`);
      window.open(`https://wa.me/${phone.startsWith('91') ? phone : `91${phone}`}?text=${text}`, '_blank');
    } else {
      handleCardClick();
    }
  };

  const isOpen = b.status === 'Open';

  return (
    <div
      onClick={handleCardClick}
      className={`cursor-pointer rounded-xl border border-slate-200 bg-white overflow-hidden hover:border-slate-300 hover:shadow-card-hover transition duration-200 flex flex-col justify-between group ${className}`}
    >
      <div>
        {/* Cover Photo & Badges */}
        <div className="relative h-36 sm:h-40 w-full overflow-hidden bg-slate-100">
          {b.img ? (
            <img
              src={b.img}
              alt={b.name}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400">
              <Store className="w-10 h-10 opacity-30" />
              <span className="text-[11px] font-medium text-slate-500 mt-1">{b.cat}</span>
            </div>
          )}

          {/* Status Badge */}
          <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-white/95 backdrop-blur-xs text-slate-800 text-[10px] font-medium flex items-center gap-1.5 shadow-xs border border-slate-200/80">
            <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            <span>{isOpen ? 'Open Now' : 'Closed'}</span>
          </span>

          {/* Bookmark Button */}
          {onToggleSave && (
            <button
              type="button"
              aria-label={isSaved ? 'Remove from saved' : 'Save business'}
              onClick={handleSaveClick}
              className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-white/90 hover:bg-white text-slate-600 flex items-center justify-center transition cursor-pointer shadow-xs border border-slate-200/80"
            >
              <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-rose-500 text-rose-500' : 'text-slate-500'}`} />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-3.5">
          <div className="flex items-start justify-between gap-1.5">
            <h4 className="text-sm font-bold text-slate-900 leading-snug group-hover:text-blue-600 transition line-clamp-1">
              {b.name}
            </h4>
            {b.verified && (
              <span title="Verified Local Store" className="shrink-0 text-blue-600">
                <CheckCircle2 className="w-4 h-4 fill-blue-50 text-blue-600" />
              </span>
            )}
          </div>

          {/* Rating & Category */}
          <div className="flex items-center gap-2 mt-1">
            {b.rating && b.rating !== 'New' && b.rating !== '0.0' ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[11px] font-semibold">
                <Star className="w-3 h-3 text-emerald-600 fill-emerald-600" />
                <span>{b.rating}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium">
                New
              </span>
            )}
            {b.reviews && b.reviews !== '(0)' && (
              <span className="text-[11px] font-normal text-slate-400">
                {b.reviews}
              </span>
            )}
            <span className="text-slate-300">•</span>
            <span className="text-[11px] font-medium text-slate-500 truncate">
              {b.cat}
            </span>
          </div>

          {/* Delivery & Distance Meta */}
          <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-2 font-medium">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" /> 15–20 min
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate">{b.dist} • {b.address}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="px-3.5 pb-3.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleCardClick}
          className="flex-1 py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition text-center cursor-pointer shadow-xs"
        >
          View Store
        </button>

        {b.whatsapp || b.phone ? (
          <button
            type="button"
            onClick={handleWhatsAppClick}
            className="w-8 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center transition cursor-pointer"
            title="Chat with Merchant on WhatsApp"
          >
            <MessageCircle className="w-4 h-4" />
          </button>
        ) : null}

        {b.phone ? (
          <button
            type="button"
            onClick={handlePhoneClick}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center justify-center transition cursor-pointer"
            title="Call Store"
          >
            <Phone className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
};
