import { LiveAlertItem } from './liveIntelligence';
import { MerchantLeadItem, MerchantReviewItem } from '../merchant/types';

export const REALTIME_STATUS_EVENT = 'myarea24_realtime_status';
export const CIVIC_ALERT_EVENT = 'myarea24_live_civic_alert';
export const MERCHANT_LEAD_EVENT = 'myarea24_merchant_live_lead';
export const MERCHANT_INQUIRY_EVENT = 'myarea24_merchant_live_message';
export const MERCHANT_REVIEW_EVENT = 'myarea24_merchant_live_review';
export const ORDER_STATUS_EVENT = 'myarea24_order_status_update';
export const MERCHANT_ORDER_EVENT = 'myarea24_merchant_live_order';
export const WAKELOCK_STATUS_EVENT = 'myarea24_wakelock_status';
export const PUSH_SUBSCRIPTION_EVENT = 'myarea24_push_status';

export function urlB64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type RealtimeConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface RealtimeSubscriptionOptions {
  area?: string;
  businessId?: string;
  lat?: number;
  lon?: number;
}

export interface LiveCivicAlertEventDetail {
  alert: LiveAlertItem;
  timestamp: string;
}

export interface LiveMerchantLeadEventDetail {
  lead: MerchantLeadItem;
  businessId: string;
  timestamp: string;
}

export interface LiveMerchantInquiryEventDetail {
  inquiry: {
    id: string;
    customerName: string;
    message: string;
    timeAgo: string;
    business_id?: string;
  };
  businessId: string;
  timestamp: string;
}

export interface LiveMerchantReviewEventDetail {
  review: MerchantReviewItem;
  businessId: string;
  timestamp: string;
}

export interface LiveOrderStatusEventDetail {
  orderNumber: string;
  status: string;
  paymentStatus?: string;
  notes?: string;
  updatedAt: string;
}

export interface LiveMerchantOrderEventDetail {
  order: any;
  businessId: string;
  timestamp: string;
}

import { getApiBaseUrl } from '../config/apiClient';

function getBackendUrl(): string | null {
  return getApiBaseUrl();
}

let sharedAudioCtx: AudioContext | null = null;

function getSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    try {
      sharedAudioCtx = new AudioCtx();
    } catch {
      return null;
    }
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

// User-gesture unlock listener to resume suspended AudioContext on first interaction
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('click', unlockAudio, { passive: true, once: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true, once: true });
  window.addEventListener('keydown', unlockAudio, { passive: true, once: true });
}

// Gentle Web Audio API synthesizer for instant zero-dependency sound alerts
function playSoundNotification(type: 'alert' | 'lead' | 'order') {
  if (typeof window !== 'undefined') {
    try {
      const consentRaw = localStorage.getItem('myarea24_dpdp_consent');
      if (consentRaw) {
        const consent = JSON.parse(consentRaw);
        if (consent.notifications === false && type === 'alert') {
          return; // Suppress civic notification audio if user disabled notifications
        }
      }
    } catch {}
  }
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
      try {
        const audio = new Audio('/chime.wav');
        audio.volume = 0.85;
        audio.play().catch(() => {});
      } catch {}
      return;
    }

    if (type === 'alert') {
      // 2-tone urgent alert ping (880Hz -> 440Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.36);
    } else if (type === 'order') {
      // 4-tone resonant cash register chime with overtone bell for new orders:
      // D5 (587.3Hz) -> G5 (784Hz) -> B5 (987.8Hz) -> high overtone E6 (1318.5Hz)
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const overtone = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, t);
      osc.frequency.setValueAtTime(783.99, t + 0.12);
      osc.frequency.setValueAtTime(987.77, t + 0.24);
      osc.frequency.setValueAtTime(1318.51, t + 0.36);

      overtone.type = 'sine';
      overtone.frequency.setValueAtTime(1174.66, t);
      overtone.frequency.setValueAtTime(1567.98, t + 0.12);
      overtone.frequency.setValueAtTime(1975.53, t + 0.24);

      gain.gain.setValueAtTime(0.26, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);

      osc.connect(gain);
      overtone.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      overtone.start(t);
      osc.stop(t + 0.66);
      overtone.stop(t + 0.66);

      // Mobile device vibration pattern for lock screen ring:
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([300, 100, 300, 100, 300, 100, 500]);
        } catch {}
      }
    } else {
      // Pleasant 2-tone chime for leads & messages (523Hz -> 659Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.31);
    }
  } catch {
    // Ignore audio autoplays blocked by user gesture policy
  }
}

class RealtimePushService {
  private socket: WebSocket | null = null;
  private sseSource: EventSource | null = null;
  private status: RealtimeConnectionStatus = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectDelay = 15000;
  private reconnectTimer: any = null;
  private pingTimer: any = null;
  private options: RealtimeSubscriptionOptions = {};
  private clientId = `client-${Math.random().toString(36).substring(2, 9)}`;
  private activeOrderSubscriptions: Set<string> = new Set();
  private lastActiveTimestamp = Date.now();
  private wakeLock: any = null;
  private isWakeLockRequested = false;
  private swRegistration: ServiceWorkerRegistration | null = null;
  private seenAlertHashes: Map<string, number> = new Map();
  private recentAlertTimestamps: number[] = [];
  private readonly ALERT_WINDOW_MS = 15 * 60 * 1000; // 15 mins fatigue prevention window
  private readonly MAX_ALERTS_PER_WINDOW = 3;

  constructor() {
    // Listen for tab focus, online status & wake-from-sleep to quickly re-establish socket and sync missed orders
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.reconnect());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          // Re-engage screen wake lock if merchant had activated it
          if (this.isWakeLockRequested && !this.wakeLock) {
            this.requestWakeLock().catch(() => {});
          }
          // Re-establish socket if suspended while device was asleep
          if (this.status === 'disconnected' || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
            this.reconnect();
          }
          // Recover any missed orders that arrived while the screen was sleeping
          const elapsedSleepMs = Date.now() - this.lastActiveTimestamp;
          if (elapsedSleepMs > 4000 && this.options.businessId) {
            this.syncMissedMerchantOrders(this.options.businessId).catch(() => {});
          }
          this.lastActiveTimestamp = Date.now();
        } else {
          this.lastActiveTimestamp = Date.now();
        }
      });

      // Automatically register service worker for background lock-screen push notifications
      this.initServiceWorker().catch(() => {});
    }
  }

  public getStatus(): RealtimeConnectionStatus {
    return this.status;
  }

  private setStatus(s: RealtimeConnectionStatus) {
    this.status = s;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(REALTIME_STATUS_EVENT, { detail: { status: s } })
      );
    }
  }

  public connect(options: RealtimeSubscriptionOptions = {}) {
    this.options = { ...this.options, ...options };
    this.cleanup();
    this.initWebSocket();
  }

  public subscribeToOrder(orderNumber: string) {
    if (!orderNumber) return;
    const clean = orderNumber.trim();
    this.activeOrderSubscriptions.add(clean);
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({ type: 'SUBSCRIBE', channel: `order:${clean.toLowerCase()}` })
      );
    }
  }

  public unsubscribeFromOrder(orderNumber: string) {
    if (!orderNumber) return;
    const clean = orderNumber.trim();
    this.activeOrderSubscriptions.delete(clean);
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({ type: 'UNSUBSCRIBE', channel: `order:${clean.toLowerCase()}` })
      );
    }
  }

  public updateSubscriptions(updates: Partial<RealtimeSubscriptionOptions>) {
    const oldArea = this.options.area;
    const oldBiz = this.options.businessId;
    this.options = { ...this.options, ...updates };

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      if (updates.area && updates.area !== oldArea) {
        if (oldArea) {
          this.socket.send(
            JSON.stringify({ type: 'UNSUBSCRIBE', channel: `civic:${oldArea.toLowerCase()}` })
          );
        }
        this.socket.send(
          JSON.stringify({ type: 'SUBSCRIBE', channel: `civic:${updates.area.toLowerCase()}` })
        );
      }
      if (updates.businessId && updates.businessId !== oldBiz) {
        if (oldBiz) {
          this.socket.send(
            JSON.stringify({ type: 'UNSUBSCRIBE', channel: `merchant:${oldBiz}` })
          );
        }
        this.socket.send(
          JSON.stringify({ type: 'SUBSCRIBE', channel: `merchant:${updates.businessId}` })
        );
      }
    }
  }

  private getWebSocketUrl(): string | null {
    const rawBackend = getBackendUrl();
    if (rawBackend === null) return null;

    let baseWs = '';
    if (rawBackend === '') {
      if (typeof window !== 'undefined') {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        baseWs = `${proto}//${window.location.host}`;
      } else {
        baseWs = 'ws://127.0.0.1:8000';
      }
    } else {
      baseWs = rawBackend.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:').replace(/\/+$/, '');
    }

    const params = new URLSearchParams();
    params.set('client_id', this.clientId);
    if (this.options.area) params.set('area', this.options.area);
    if (this.options.businessId) params.set('business_id', this.options.businessId);

    return `${baseWs}/api/v1/ws?${params.toString()}`;
  }

  private initWebSocket() {
    const wsUrl = this.getWebSocketUrl();
    if (!wsUrl) {
      this.setStatus('disconnected');
      return;
    }

    this.setStatus('connecting');

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus('connected');
        this.startHeartbeat();

        // Resubscribe to tracked order channels
        if (this.activeOrderSubscriptions.size > 0 && this.socket) {
          for (const ord of this.activeOrderSubscriptions) {
            try {
              this.socket.send(
                JSON.stringify({ type: 'SUBSCRIBE', channel: `order:${ord.toLowerCase()}` })
              );
            } catch {}
          }
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleIncomingMessage(msg);
        } catch (e) {
          console.warn('[ws] could not parse frame', e);
        }
      };

      this.socket.onerror = (e) => {
        console.warn('[ws] socket error, falling back if offline', e);
      };

      this.socket.onclose = () => {
        this.stopHeartbeat();
        this.setStatus('reconnecting');
        this.scheduleReconnect();
      };
    } catch (err) {
      console.warn('[ws] failed to construct websocket, starting fallback', err);
      this.startSseFallback();
    }
  }

  private handleIncomingMessage(msg: any) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'CONNECTED':
        // If initial active alerts returned, broadcast them
        if (Array.isArray(msg.active_alerts) && msg.active_alerts.length > 0) {
          for (const a of msg.active_alerts) {
            this.dispatchCivicAlert(a, false);
          }
        }
        break;

      case 'CIVIC_ALERT':
        if (msg.alert) {
          playSoundNotification('alert');
          this.dispatchCivicAlert(msg.alert, true);
        }
        break;

      case 'MERCHANT_LEAD':
        if (msg.data) {
          playSoundNotification('lead');
          this.dispatchMerchantLead(msg.data, msg.business_id);
        }
        break;

      case 'MERCHANT_INQUIRY':
        if (msg.data) {
          playSoundNotification('lead');
          this.dispatchMerchantInquiry(msg.data, msg.business_id);
        }
        break;

      case 'MERCHANT_REVIEW':
        if (msg.data) {
          playSoundNotification('lead');
          this.dispatchMerchantReview(msg.data, msg.business_id);
        }
        break;

      case 'MERCHANT_ORDER':
        if (msg.data) {
          playSoundNotification('order');
          this.dispatchMerchantOrder(msg.data, msg.business_id);
        }
        break;

      case 'ORDER_STATUS_UPDATE':
        if (msg.order_number || msg.data?.order_number) {
          playSoundNotification('lead');
          this.dispatchOrderStatusUpdate(msg);
        }
        break;

      case 'PONG':
        // Heartbeat acknowledged
        break;
    }
  }

  private dispatchCivicAlert(rawAlert: any, isPush: boolean) {
    const title = (rawAlert.title || '').trim().toLowerCase();
    const area = (rawAlert.areaDescription || this.options.area || '').trim().toLowerCase();
    const alertKey = `${title}::${area}`;
    const now = Date.now();

    // 1. Alert Deduplication: Suppress duplicates within 15 mins
    const lastSeen = this.seenAlertHashes.get(alertKey);
    if (lastSeen && now - lastSeen < this.ALERT_WINDOW_MS) {
      return;
    }
    this.seenAlertHashes.set(alertKey, now);

    // Evict old hash entries
    for (const [key, ts] of this.seenAlertHashes.entries()) {
      if (now - ts > this.ALERT_WINDOW_MS) {
        this.seenAlertHashes.delete(key);
      }
    }

    const sev = rawAlert.severity === 'Critical' ? 'Critical' : 'Important';

    // 2. Alert Fatigue Rate Limiter: Max 3 non-critical alerts per 15 mins
    this.recentAlertTimestamps = this.recentAlertTimestamps.filter((t) => now - t < this.ALERT_WINDOW_MS);
    if (sev !== 'Critical' && this.recentAlertTimestamps.length >= this.MAX_ALERTS_PER_WINDOW) {
      return;
    }
    this.recentAlertTimestamps.push(now);

    const alertItem: LiveAlertItem = {
      id: rawAlert.id || `alert-${Date.now()}`,
      title: rawAlert.title || 'Civic Notice',
      description: rawAlert.description || '',
      instruction: rawAlert.instruction || 'Follow local municipal guidance.',
      areaDescription: rawAlert.areaDescription || this.options.area || 'Local Area',
      category: rawAlert.category || 'Civic',
      severity: sev,
      sender: rawAlert.sender || 'NDMA SACHET',
      timeAgo: rawAlert.timeAgo || 'Just now',
      badgeClass:
        sev === 'Critical'
          ? 'bg-rose-600 text-white animate-pulse'
          : 'bg-amber-500 text-white',
      icon: 'AlertTriangle',
    };

    window.dispatchEvent(
      new CustomEvent(CIVIC_ALERT_EVENT, {
        detail: {
          alert: alertItem,
          isPush,
          timestamp: new Date().toISOString(),
        },
      })
    );
  }

  private dispatchMerchantLead(data: any, businessId: string) {
    const now = new Date();
    const lead: MerchantLeadItem = {
      id: data.id || `lead-${Date.now()}`,
      customerName: data.customerName || 'Inquiring Customer',
      phone: data.phone || '+91 98000 00000',
      email: data.email || 'customer@example.com',
      enquiryText: `${data.topic ? `[${data.topic}] ` : ''}${data.message || 'Direct quote request'}`,
      source: 'Website',
      date: now.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      status: 'New',
      interestedCategory: data.topic || 'General Services',
      preferredDate: 'Flexible',
    };

    window.dispatchEvent(
      new CustomEvent(MERCHANT_LEAD_EVENT, {
        detail: {
          lead,
          businessId: businessId || this.options.businessId || 'default',
          timestamp: now.toISOString(),
        },
      })
    );
  }

  private dispatchMerchantInquiry(data: any, businessId: string) {
    window.dispatchEvent(
      new CustomEvent(MERCHANT_INQUIRY_EVENT, {
        detail: {
          inquiry: data,
          businessId: businessId || this.options.businessId || 'default',
          timestamp: new Date().toISOString(),
        },
      })
    );
  }

  private dispatchMerchantReview(data: any, businessId: string) {
    const review: MerchantReviewItem = {
      id: data.id || `rev-${Date.now()}`,
      customerName: data.customerName || 'Verified Patron',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
      rating: Number(data.rating) || 5,
      timeAgo: data.timeAgo || 'Just now',
      isVerified: true,
      comment: data.comment || 'Wonderful service and quick turnaround!',
      tags: ['Verified Customer', 'Prompt Service'],
    };

    window.dispatchEvent(
      new CustomEvent(MERCHANT_REVIEW_EVENT, {
        detail: {
          review,
          businessId: businessId || this.options.businessId || 'default',
          timestamp: new Date().toISOString(),
        },
      })
    );
  }

  private dispatchMerchantOrder(orderData: any, businessId: string) {
    window.dispatchEvent(
      new CustomEvent(MERCHANT_ORDER_EVENT, {
        detail: {
          order: orderData,
          businessId: businessId || this.options.businessId || 'default',
          timestamp: new Date().toISOString(),
        },
      })
    );
  }

  private dispatchOrderStatusUpdate(updateData: any) {
    const raw = updateData.data || updateData;
    window.dispatchEvent(
      new CustomEvent(ORDER_STATUS_EVENT, {
        detail: {
          orderNumber: raw.order_number || updateData.order_number,
          status: raw.status || updateData.status,
          paymentStatus: raw.payment_status || updateData.payment_status,
          notes: raw.notes || updateData.notes,
          updatedAt: raw.updated_at || updateData.timestamp || new Date().toISOString(),
        },
      })
    );
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'PING' }));
      }
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectAttempts++;
    if (this.reconnectAttempts > 3) {
      // Avoid infinite retry loops when backend is offline
      this.setStatus('disconnected');
      return;
    }

    // Exponential backoff: 1.5s, 3s, 6s
    const delay = Math.min(
      this.maxReconnectDelay,
      1500 * Math.pow(2, this.reconnectAttempts - 1) + Math.random() * 500
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.initWebSocket();
    }, delay);
  }

  private startSseFallback() {
    if (typeof EventSource === 'undefined') return;
    this.stopHeartbeat();
    if (this.socket) {
      try {
        this.socket.close();
      } catch {}
      this.socket = null;
    }

    const rawBackend = getBackendUrl();
    if (rawBackend === null) {
      this.setStatus('disconnected');
      return;
    }
    const channels = ['civic', `merchant:${this.options.businessId || 'biz-daily-brew'}`].join(',');
    const sseUrl = `${rawBackend.replace(/\/+$/, '')}/api/v1/ws/sse?channels=${encodeURIComponent(channels)}`;

    let sseErrorCount = 0;
    try {
      this.sseSource = new EventSource(sseUrl);
      this.sseSource.onopen = () => {
        this.setStatus('connected');
      };
      this.sseSource.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          this.handleIncomingMessage(msg);
        } catch {}
      };
      this.sseSource.onerror = () => {
        sseErrorCount++;
        if (sseErrorCount > 2) {
          if (this.sseSource) {
            this.sseSource.close();
            this.sseSource = null;
          }
          this.setStatus('disconnected');
        } else {
          this.setStatus('reconnecting');
        }
      };
    } catch (e) {
      console.warn('[sse] fallback could not connect', e);
    }
  }

  public reconnect() {
    this.reconnectAttempts = 0;
    this.cleanup();
    this.initWebSocket();
  }

  public cleanup() {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.close();
      } catch {}
      this.socket = null;
    }
    if (this.sseSource) {
      try {
        this.sseSource.close();
      } catch {}
      this.sseSource = null;
    }
    this.setStatus('disconnected');
  }

  // =========================================================================
  // SIMULATION / TRIGGER HELPER METHODS
  // =========================================================================

  public async triggerCivicAlert(alertData?: Partial<LiveAlertItem>): Promise<boolean> {
    const rawBackend = getBackendUrl();
    if (rawBackend) {
      try {
        const res = await fetch(`${rawBackend.replace(/\/+$/, '')}/api/v1/ws/trigger-civic-alert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: alertData?.title || '🚨 Flash Flood & Waterlogging Warning — NDMA SACHET',
            description:
              alertData?.description ||
              `Waterlogging and traffic diversions active near low-lying roads in ${this.options.area || 'your area'}.`,
            severity: alertData?.severity || 'Critical',
            category: 'Civic Emergency',
            sender: 'NDMA SACHET (CAP v1.2)',
            target_area: this.options.area,
            instruction: 'Avoid arterial underpasses and follow civic emergency lines (1077).',
          }),
        });
        if (res.ok) return true;
      } catch {
        // Fall back to client dispatch
      }
    }
    // If backend offline, simulate client-side frame
      this.dispatchCivicAlert(
        {
          id: `sim-${Date.now()}`,
          title: alertData?.title || '🚨 Flash Flood & Waterlogging Warning — NDMA SACHET',
          description:
            alertData?.description ||
            `Waterlogging and traffic diversions active near low-lying roads in ${this.options.area || 'your area'}.`,
          severity: 'Critical',
          category: 'Weather',
          sender: 'NDMA SACHET (CAP v1.2)',
          instruction: 'Avoid arterial underpasses and follow civic emergency lines (1077).',
          timeAgo: 'Just now',
        },
        true
      );
      return true;
  }

  public async triggerMerchantLead(custom?: {
    customerName?: string;
    topic?: string;
    phone?: string;
    message?: string;
  }): Promise<boolean> {
    const rawBackend = getBackendUrl();
    const bizId = this.options.businessId || 'biz-daily-brew';

    if (rawBackend) {
      try {
        const res = await fetch(`${rawBackend.replace(/\/+$/, '')}/api/v1/ws/trigger-merchant-lead`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            business_id: bizId,
            customer_name: custom?.customerName || 'Aarav Sharma',
            customer_phone: custom?.phone || '+91 98112 44321',
            customer_email: 'aarav.sharma@example.com',
            enquiry_type: 'quote',
            topic: custom?.topic || 'Catering & Bulk Coffee Order',
            message:
              custom?.message ||
              'Hi! Inquiring for 35 corporate snack & coffee kits for this Friday afternoon.',
            locality: this.options.area || 'Local Area',
          }),
        });
        if (res.ok) return true;
      } catch {
        // Fallback local dispatch
      }
    }
      this.dispatchMerchantLead(
        {
          id: `lead-sim-${Date.now()}`,
          customerName: custom?.customerName || 'Aarav Sharma',
          phone: custom?.phone || '+91 98112 44321',
          email: 'aarav.sharma@example.com',
          topic: custom?.topic || 'Catering & Bulk Coffee Order',
          message:
            custom?.message ||
            'Hi! Inquiring for 35 corporate snack & coffee kits for this Friday afternoon.',
        },
        bizId
      );
      return true;
  }

  public async triggerMerchantInquiry(customerName = 'Neha Kapoor', message = 'Do you offer vegan almond milk options for delivery?'): Promise<boolean> {
    const rawBackend = getBackendUrl();
    const bizId = this.options.businessId || 'biz-daily-brew';

    if (rawBackend) {
      try {
        const res = await fetch(`${rawBackend.replace(/\/+$/, '')}/api/v1/ws/trigger-merchant-inquiry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            business_id: bizId,
            customer_name: customerName,
            message,
            time_ago: 'Just now',
          }),
        });
        if (res.ok) return true;
      } catch {
        // Fallback local dispatch
      }
    }
    this.dispatchMerchantInquiry(
      {
        id: `inq-${Date.now()}`,
        customerName,
        message,
        timeAgo: 'Just now',
      },
      bizId
    );
    return true;
  }

  public async triggerMerchantReview(customerName = 'Rahul Mehra', rating = 5, comment = 'Super fast delivery and the packaging was top notch! 10/10'): Promise<boolean> {
    const rawBackend = getBackendUrl();
    const bizId = this.options.businessId || 'biz-daily-brew';

    if (rawBackend) {
      try {
        const res = await fetch(`${rawBackend.replace(/\/+$/, '')}/api/v1/ws/trigger-merchant-review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            business_id: bizId,
            customer_name: customerName,
            rating,
            comment,
            time_ago: 'Just now',
          }),
        });
        if (res.ok) return true;
      } catch {
        // Fallback local dispatch
      }
    }
      this.dispatchMerchantReview(
        {
          id: `rev-${Date.now()}`,
          customerName,
          rating,
          comment,
          timeAgo: 'Just now',
        },
        bizId
      );
      return true;
  }

  public async triggerMerchantOrder(custom?: {
    orderNumber?: string;
    businessName?: string;
    customerName?: string;
    customerPhone?: string;
    deliveryAddress?: string;
    finalPayable?: number;
    items?: any[];
  }): Promise<boolean> {
    const rawBackend = getBackendUrl();
    const bizId = this.options.businessId || 'biz-registered-store';

    if (rawBackend) {
      try {
        const res = await fetch(`${rawBackend.replace(/\/+$/, '')}/api/v1/ws/trigger-merchant-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            business_id: bizId,
            business_name: custom?.businessName || (this.options.businessId ? 'Your Storefront' : 'Verified Storefront'),
            customer_name: custom?.customerName || 'Local Citizen',
            customer_phone: custom?.customerPhone || '+91 98000 00000',
            delivery_address: custom?.deliveryAddress || (this.options.area ? `Sector Block, ${this.options.area}` : 'Local Residential Complex'),
            final_payable: custom?.finalPayable || 380.0,
            items: custom?.items,
          }),
        });
        if (res.ok) return true;
      } catch {
        // Fallback local dispatch
      }
    }

    const orderNum = custom?.orderNumber || `MA24-ORD-${Math.floor(1000 + Math.random() * 9000)}`;
    this.dispatchMerchantOrder(
      {
        id: `ord-local-${Date.now()}`,
        order_number: orderNum,
        business_id: bizId,
        business_name: custom?.businessName || 'Verified Storefront',
        customer_name: custom?.customerName || 'Local Citizen',
        customer_phone: custom?.customerPhone || '+91 98000 00000',
        delivery_address: custom?.deliveryAddress || (this.options.area ? `Sector Block, ${this.options.area}` : 'Local Residential Complex'),
        final_payable: custom?.finalPayable || 380.0,
        payment_method: 'upi_qr',
        payment_status: 'paid',
        status: 'placed',
        estimated_delivery_mins: 20,
        created_at: new Date().toISOString(),
        items: custom?.items || [
          { product_name: 'Caramel Macchiato (Large)', unit_price: 190.0, quantity: 1, total_price: 190.0 },
          { product_name: 'Fresh Blueberry Muffin', unit_price: 190.0, quantity: 1, total_price: 190.0 },
        ],
      },
      bizId
    );
    return true;
  }

  public async triggerOrderStatusUpdate(orderNumber: string, status: string): Promise<boolean> {
    const rawBackend = getBackendUrl();
    if (rawBackend) {
      try {
        const token = localStorage.getItem('myarea24_merchant_token') || localStorage.getItem('myarea24_auth_token');
        const res = await fetch(`${rawBackend.replace(/\/+$/, '')}/api/v1/ws/trigger-order-status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            order_number: orderNumber,
            status,
            payment_status: 'paid',
            notes: `Order transitioned to ${status}`,
          }),
        });
        if (res.ok) return true;
      } catch {
        // Fallback local dispatch
      }
    }
    this.dispatchOrderStatusUpdate({
      order_number: orderNumber,
      status,
      payment_status: 'paid',
      notes: `Order transitioned to ${status}`,
      updated_at: new Date().toISOString(),
    });
    return true;
  }

  // =========================================================================
  // AUDIO CHIME & SERVICE WORKER BACKGROUND WEB PUSH NOTIFICATIONS
  // =========================================================================

  /**
   * Explicitly triggers the resonant cash register order chime with overtone bell & device vibration.
   */
  public playOrderChime(loud: boolean = true) {
    playSoundNotification('order');
  }

  /**
   * Initializes the Service Worker for background order notifications and lock-screen ringing.
   */
  public async initServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return null;
    }
    try {
      this.swRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

      // Listen for push notifications received while screen was asleep or in background
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (!event.data) return;
        if (event.data.type === 'PUSH_ORDER_RECEIVED') {
          const payload = event.data.payload || {};
          this.playOrderChime(true);
          if (payload.orderNumber || payload.businessId) {
            this.dispatchMerchantOrder(payload, payload.businessId || this.options.businessId || 'default');
          }
        } else if (event.data.type === 'FOCUS_ORDER') {
          this.playOrderChime(true);
        }
      });

      return this.swRegistration;
    } catch (e) {
      console.warn('[sw] Service worker registration error:', e);
      return null;
    }
  }

  /**
   * Requests browser notification permission.
   */
  public async requestNotificationPermission(): Promise<NotificationPermission> {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      return 'denied';
    }
    try {
      return await Notification.requestPermission();
    } catch {
      return Notification.permission;
    }
  }

  /**
   * Returns current Web Push support and subscription status.
   */
  public async getPushSubscriptionStatus(): Promise<{
    supported: boolean;
    permission: NotificationPermission;
    isSubscribed: boolean;
    endpoint?: string;
  }> {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      typeof Notification === 'undefined'
    ) {
      return { supported: false, permission: 'denied', isSubscribed: false };
    }
    const permission = Notification.permission;
    try {
      const reg = this.swRegistration || (await navigator.serviceWorker.getRegistration());
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      return {
        supported: true,
        permission,
        isSubscribed: Boolean(sub),
        endpoint: sub?.endpoint,
      };
    } catch {
      return { supported: true, permission, isSubscribed: false };
    }
  }

  /**
   * Subscribes the merchant device to Web Push notifications using VAPID.
   * Enables lock screen audio chime and push alerts when the screen is locked/sleeping.
   */
  public async subscribeMerchantToPush(
    businessId: string
  ): Promise<{ success: boolean; error?: string; subscription?: any }> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return { success: false, error: 'Web Push Notifications are not supported by this browser.' };
    }

    try {
      const reg = this.swRegistration || (await this.initServiceWorker());
      if (!reg) {
        return { success: false, error: 'Could not register Service Worker.' };
      }

      const permission = await this.requestNotificationPermission();
      if (permission !== 'granted') {
        return { success: false, error: 'Notification permission was denied. Please allow notifications in browser settings.' };
      }

      // 1. Fetch server VAPID public key
      const rawBackend = getBackendUrl();
      let vapidKey = 'BA7XldkXdRawZgM1WzKjpCqCBSl8xAMh3PKO-SQuyNrHgXV9ACSkiSnDQcmVI25peq-nG0a6QviXHLKyZ2f8j8g';
      if (rawBackend) {
        try {
          const res = await fetch(`${rawBackend.replace(/\/+$/, '')}/api/v1/merchant/push-subscription/public-key`);
          if (res.ok) {
            const data = await res.json();
            if (data.public_key) vapidKey = data.public_key;
          }
        } catch {}
      }

      const applicationServerKey = urlB64ToUint8Array(vapidKey);

      // 2. Subscribe with PushManager
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      const subJson = sub.toJSON();
      const p256dh = subJson.keys?.p256dh || '';
      const auth = subJson.keys?.auth || '';

      // 3. Register endpoint with backend database
      if (rawBackend) {
        const token =
          localStorage.getItem('myarea24_merchant_token') || localStorage.getItem('myarea24_auth_token');
        await fetch(`${rawBackend.replace(/\/+$/, '')}/api/v1/merchant/push-subscription`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            business_id: businessId,
            endpoint: sub.endpoint,
            p256dh,
            auth,
            user_agent: navigator.userAgent,
          }),
        });
      }

      localStorage.setItem('myarea24_push_subscribed', 'true');
      window.dispatchEvent(
        new CustomEvent(PUSH_SUBSCRIPTION_EVENT, { detail: { isSubscribed: true, businessId } })
      );

      return { success: true, subscription: subJson };
    } catch (err: any) {
      console.warn('[webpush] Error subscribing to Web Push:', err);
      return { success: false, error: err?.message || 'Failed to complete push subscription.' };
    }
  }

  /**
   * Unsubscribes merchant from Web Push alerts.
   */
  public async unsubscribeMerchantFromPush(businessId: string): Promise<boolean> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;
    try {
      const reg = this.swRegistration || (await navigator.serviceWorker.getRegistration());
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const endpoint = sub.endpoint;
          await sub.unsubscribe();
          const rawBackend = getBackendUrl();
          if (rawBackend) {
            try {
              await fetch(
                `${rawBackend.replace(/\/+$/, '')}/api/v1/merchant/push-subscription?endpoint=${encodeURIComponent(endpoint)}&business_id=${encodeURIComponent(businessId)}`,
                { method: 'DELETE' }
              );
            } catch {}
          }
        }
      }
      localStorage.removeItem('myarea24_push_subscribed');
      window.dispatchEvent(
        new CustomEvent(PUSH_SUBSCRIPTION_EVENT, { detail: { isSubscribed: false, businessId } })
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Dispatches a test order audio chime ring and lock screen notification.
   */
  public async triggerTestPush(businessId: string): Promise<boolean> {
    // 1. Play loud resonant audio chime immediately on current device
    this.playOrderChime(true);

    // 2. Dispatch service worker test notification
    if (this.swRegistration && this.swRegistration.active) {
      this.swRegistration.active.postMessage({
        type: 'TEST_NOTIFICATION',
        title: '🛍️ Order Alert Ring Test — MyArea24',
        body: 'Cash register chime and lock-screen ring verified! Your store is armed to ring even when asleep.',
      });
    }

    // 3. Trigger backend push to registered mobile endpoints
    const rawBackend = getBackendUrl();
    if (rawBackend) {
      try {
        await fetch(
          `${rawBackend.replace(/\/+$/, '')}/api/v1/merchant/test-push?business_id=${encodeURIComponent(businessId)}`,
          { method: 'POST' }
        );
      } catch {}
    }
    return true;
  }

  // =========================================================================
  // SCREEN WAKE LOCK API (Prevents phone from sleeping during shop hours)
  // =========================================================================

  /**
   * Requests Screen Wake Lock so phone screen does not turn off while on counter duty.
   */
  public async requestWakeLock(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        this.isWakeLockRequested = true;
        this.wakeLock = await (navigator as any).wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => {
          this.wakeLock = null;
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(WAKELOCK_STATUS_EVENT, { detail: { active: false } }));
          }
        });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(WAKELOCK_STATUS_EVENT, { detail: { active: true } }));
        }
        return true;
      } catch (e) {
        console.warn('[wakeLock] Request failed:', e);
        return false;
      }
    }
    return false;
  }

  /**
   * Releases Screen Wake Lock.
   */
  public async releaseWakeLock(): Promise<boolean> {
    this.isWakeLockRequested = false;
    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
        this.wakeLock = null;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(WAKELOCK_STATUS_EVENT, { detail: { active: false } }));
        }
        return true;
      } catch {}
    }
    return false;
  }

  /**
   * Returns whether Screen Wake Lock is currently holding the display awake.
   */
  public isWakeLockActive(): boolean {
    return Boolean(this.wakeLock);
  }

  // =========================================================================
  // MISSED ORDER SYNCHRONIZATION ON WAKE FROM SLEEP
  // =========================================================================

  /**
   * Polls the backend for orders placed while the screen was sleeping/locked.
   * Plays the chime and dispatches the live event for each missed order.
   */
  public async syncMissedMerchantOrders(businessId: string): Promise<number> {
    const rawBackend = getBackendUrl();
    if (!rawBackend) return 0;
    try {
      const token =
        localStorage.getItem('myarea24_merchant_token') || localStorage.getItem('myarea24_auth_token');
      const url = `${rawBackend.replace(/\/+$/, '')}/api/v1/merchant/orders?business_id=${encodeURIComponent(businessId)}`;
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) return 0;
      const json = await res.json();
      const orders = Array.isArray(json.orders) ? json.orders : [];
      let newOrdersCount = 0;

      for (const ord of orders) {
        const orderTime = new Date(ord.createdAt || ord.created_at).getTime();
        // Check if placed within the recent sleep window
        if (orderTime >= this.lastActiveTimestamp - 5000 && (ord.status === 'placed' || ord.status === 'confirmed')) {
          newOrdersCount++;
          this.playOrderChime(true);
          this.dispatchMerchantOrder(ord, businessId);
        }
      }
      return newOrdersCount;
    } catch {
      return 0;
    }
  }
  }

// Global singleton instance
export const realtimeService = new RealtimePushService();
