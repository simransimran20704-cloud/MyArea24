import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Phone,
  MessageSquare,
  ShieldCheck,
  Navigation,
  Clock,
  Gauge,
  MapPin,
  CheckCircle,
  Truck,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

interface LiveDriverTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: string;
  storeName?: string;
  customerName?: string;
  deliveryAddress?: string;
  deliveryCoords?: { lat: number; lng: number };
}

export const LiveDriverTrackerModal: React.FC<LiveDriverTrackerModalProps> = ({
  isOpen,
  onClose,
  orderNumber,
  storeName = 'Neighborhood Store Partner',
  customerName = 'Valued Customer',
  deliveryAddress = 'Doorstep Delivery Address, Sultanpuri',
  deliveryCoords = { lat: 28.6939, lng: 77.0693 },
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);

  // Store coordinate (approx 2.2 km away from customer)
  const storeCoords = {
    lat: deliveryCoords.lat + 0.0145,
    lng: deliveryCoords.lng - 0.0125,
  };

  // Interpolated progress of driver from store (0) to customer (1)
  const [progress, setProgress] = useState(0.35);
  const [speedKmh, setSpeedKmh] = useState(24);
  const [distanceKm, setDistanceKm] = useState(1.4);
  const [etaMins, setEtaMins] = useState(7);
  const [isSocketLive, setIsSocketLive] = useState(true);

  // Current driver interpolated position
  const currentDriverPos = {
    lat: storeCoords.lat + (deliveryCoords.lat - storeCoords.lat) * progress,
    lng: storeCoords.lng + (deliveryCoords.lng - storeCoords.lng) * progress,
  };

  // Simulate real-time GPS telemetry socket packet updates
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 0.04;
        if (next >= 0.95) return 0.95;
        return next;
      });

      setSpeedKmh(Math.floor(22 + Math.random() * 8));
      setDistanceKm((prev) => Math.max(0.2, Number((prev - 0.08).toFixed(2))));
      setEtaMins((prev) => Math.max(1, Math.round(prev - 0.2)));
    }, 2500);

    return () => clearInterval(interval);
  }, [isOpen]);

  // Update map marker position as driver moves
  useEffect(() => {
    if (!isOpen || !mapInstanceRef.current || !driverMarkerRef.current || !window.google?.maps) return;

    const newPos = {
      lat: storeCoords.lat + (deliveryCoords.lat - storeCoords.lat) * progress,
      lng: storeCoords.lng + (deliveryCoords.lng - storeCoords.lng) * progress,
    };
    driverMarkerRef.current.setPosition(newPos);
  }, [progress, isOpen, storeCoords.lat, storeCoords.lng, deliveryCoords.lat, deliveryCoords.lng]);

  // Initialize Google Maps instance inside the modal
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    const initMap = () => {
      if (!window.google?.maps || !mapContainerRef.current) return;

      const center = {
        lat: (storeCoords.lat + deliveryCoords.lat) / 2,
        lng: (storeCoords.lng + deliveryCoords.lng) / 2,
      };

      const map = new window.google.maps.Map(mapContainerRef.current, {
        center,
        zoom: 14,
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
      });
      mapInstanceRef.current = map;

      // 1. Store Marker
      new window.google.maps.Marker({
        position: storeCoords,
        map,
        title: storeName,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#7C3AED',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
        },
      });

      // 2. Customer Destination Marker
      new window.google.maps.Marker({
        position: deliveryCoords,
        map,
        title: 'Your Delivery Address',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: '#EF4444',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
        },
      });

      // 3. Driver Moving Bike Marker
      const driverMarker = new window.google.maps.Marker({
        position: currentDriverPos,
        map,
        title: 'Delivery Bike (In Transit)',
        icon: {
          path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
          scale: 1.8,
          fillColor: '#2563EB',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
          anchor: new window.google.maps.Point(12, 22),
        },
      });
      driverMarkerRef.current = driverMarker;

      // 4. Route Polyline
      new window.google.maps.Polyline({
        path: [storeCoords, deliveryCoords],
        geodesic: true,
        strokeColor: '#3B82F6',
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map,
      });
    };

    if (window.google?.maps) {
      initMap();
    } else {
      const timer = setTimeout(initMap, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 px-5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 shadow-2xs">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                  Live Delivery Tracking
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  GPS Live
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Order #{orderNumber} • Fast neighborhood doorstep fulfillment
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Map Container View */}
        <div className="relative w-full h-64 sm:h-72 bg-slate-100">
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Floating ETA Pill on Map */}
          <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-lg border border-slate-200/80 flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-blue-600 animate-spin" style={{ animationDuration: '4s' }} />
            <div>
              <p className="text-[10px] uppercase font-black tracking-wider text-slate-400">Estimated Arrival</p>
              <p className="text-xs font-black text-slate-900">
                {etaMins} mins • {distanceKm} km away
              </p>
            </div>
          </div>

          {/* Floating Speed Telemetry */}
          <div className="absolute bottom-3 left-3 bg-slate-900/90 text-white backdrop-blur-md px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 shadow-md">
            <Gauge className="w-3.5 h-3.5 text-emerald-400" />
            <span>Speed: {speedKmh} km/h</span>
          </div>
        </div>

        {/* Driver Details & Actions */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Driver Card */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="relative">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200"
                  alt="Delivery Partner"
                  className="w-12 h-12 rounded-2xl object-cover border-2 border-white shadow-xs"
                />
                <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center">
                  <CheckCircle className="w-2.5 h-2.5 text-white" />
                </span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-extrabold text-slate-900">Ramesh Kumar</h4>
                  <span className="text-[10px] font-extrabold px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded">
                    ★ 4.9
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Hero Electric Optima • <strong className="text-slate-700">DL 08 EV 4120</strong>
                </p>
                <p className="text-[11px] text-purple-700 font-semibold mt-0.5">
                  1,420+ hyper-local deliveries completed
                </p>
              </div>
            </div>

            {/* Quick Contact Buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <a
                href="tel:+919811024099"
                className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call Rider</span>
              </a>
              <a
                href="https://wa.me/919811024099?text=Hello%20Ramesh,%20checking%20status%20for%20order"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <MessageSquare className="w-3.5 h-3.5 text-slate-600" />
                <span>WhatsApp</span>
              </a>
            </div>
          </div>

          {/* Route Milestones */}
          <div className="space-y-2.5 text-xs">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                🏪
              </div>
              <div>
                <p className="font-bold text-slate-800">Picked up from Store</p>
                <p className="text-slate-500 text-[11px]">{storeName}</p>
              </div>
            </div>

            <div className="border-l-2 border-dashed border-slate-200 ml-3 h-4" />

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                🛵
              </div>
              <div>
                <p className="font-extrabold text-blue-600">On the Way to Your Doorstep</p>
                <p className="text-slate-500 text-[11px]">
                  Rider is navigating via Outer Ring Road • Moving at {speedKmh} km/h
                </p>
              </div>
            </div>

            <div className="border-l-2 border-dashed border-slate-200 ml-3 h-4" />

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                📍
              </div>
              <div>
                <p className="font-bold text-slate-800">Destination</p>
                <p className="text-slate-500 text-[11px]">{deliveryAddress}</p>
              </div>
            </div>
          </div>

          {/* Secure Handover OTP Notice */}
          <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
              <p className="text-xs font-semibold text-amber-900">
                Doorstep Delivery PIN / OTP:
              </p>
            </div>
            <span className="font-mono font-black text-sm tracking-widest bg-white border border-amber-300 text-amber-900 px-2.5 py-0.5 rounded-lg shadow-2xs">
              4829
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <p className="text-[11px] text-slate-500">
            Encrypted End-to-End WebSocket Telemetry • MyArea24 Logistics
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition"
          >
            Close Tracker
          </button>
        </div>
      </div>
    </div>
  );
};
