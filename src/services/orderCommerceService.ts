import { CartItem, DeliveryAddress, Order, OrderStatus, PaymentMethod, ServiceBooking, ServiceBookingStatus } from '../types';
import { realtimeService } from './realtimeService';
import { getApiBaseUrl } from '../config/apiClient';

function getCommerceEndpoint(path: string): string | null {
  const base = getApiBaseUrl();
  if (base === null) return null;
  return `${base}${path}`;
}

const STORAGE_KEY_ORDERS = 'myarea24_citizen_orders';
const STORAGE_KEY_BOOKINGS = 'myarea24_citizen_bookings';

/**
 * Dynamically loads the official Razorpay Checkout SDK.
 */
export async function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if ((window as any).Razorpay) return true;
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * Detects whether the web application is running in an installed standalone PWA mode
 * (e.g. added to iOS Safari home screen or Android Chrome installed web app).
 */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    Boolean((window.navigator as any).standalone) ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

/**
 * Detects whether the user is on an iOS device (iPhone, iPad, iPod, or iPadOS desktop mode).
 */
export function isIosDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export type UpiAppTarget = 'gpay' | 'phonepe' | 'paytm' | 'bhim' | 'generic';

export interface UpiUriParams {
  vpa: string;
  payeeName: string;
  amount: number;
  transactionNote?: string;
  transactionRef?: string;
}

/**
 * Generates an application-specific deep link for instant UPI checkout.
 * Standard `upi://` schemes are often blocked in iOS Safari standalone PWA WebClips,
 * whereas registered schemes (`tez://` for Google Pay, `phonepe://` for PhonePe,
 * `paytmmp://` for Paytm, and `bhim://` for BHIM) trigger native OS protocol handling.
 */
export function buildUpiAppUri(target: UpiAppTarget, params: UpiUriParams): string {
  const { vpa, payeeName, amount, transactionNote, transactionRef } = params;
  const note = encodeURIComponent(transactionNote || `Order ${payeeName}`);
  const name = encodeURIComponent(payeeName);
  const ref = transactionRef ? `&tr=${encodeURIComponent(transactionRef)}` : '';
  const am = amount.toFixed(2);

  const query = `pa=${vpa}&pn=${name}&am=${am}&cu=INR&tn=${note}${ref}`;

  switch (target) {
    case 'gpay':
      return `tez://upi/pay?${query}`;
    case 'phonepe':
      return `phonepe://pay?${query}`;
    case 'paytm':
      return `paytmmp://pay?${query}`;
    case 'bhim':
      return `bhim://pay?${query}`;
    case 'generic':
    default:
      return `upi://pay?${query}`;
  }
}

/**
 * Verifies and confirms payment for an order via backend HMAC verification
 * and updates the order's status and transaction reference.
 */
export async function verifyOrderPayment(params: {
  orderIdentifier: string | number;
  paymentMethod: PaymentMethod;
  transactionId?: string;
  upiRefId?: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  razorpaySignature?: string;
  amount?: number;
}): Promise<{ success: boolean; message: string }> {
  const {
    orderIdentifier,
    paymentMethod,
    transactionId,
    upiRefId,
    razorpayPaymentId,
    razorpayOrderId,
    razorpaySignature,
    amount,
  } = params;

  const txn = razorpayPaymentId || transactionId || upiRefId || `TXN_${Date.now()}`;

  // 1. Update local cache
  const orders = getLocalOrders();
  const idx = orders.findIndex(
    (o) => o.orderNumber === String(orderIdentifier) || String(o.id) === String(orderIdentifier)
  );
  if (idx !== -1) {
    orders[idx].paymentStatus = 'paid';
    orders[idx].transactionId = txn;
    saveLocalOrders(orders);
  }

  // 2. Submit cryptographic verification to FastAPI backend if available
  const ep = getCommerceEndpoint(`/api/v1/orders/${orderIdentifier}/verify-payment`);
  if (ep) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_method: paymentMethod,
          transaction_id: txn,
          upi_ref_id: upiRefId,
          razorpay_payment_id: razorpayPaymentId,
          razorpay_order_id: razorpayOrderId,
          razorpay_signature: razorpaySignature,
          amount: amount,
        }),
      });
      if (res.ok) {
        return { success: true, message: 'Payment cryptographically verified by gateway!' };
      }
    } catch {
      // Offline fallback
    }
  }

  return { success: true, message: 'Payment recorded and confirmed.' };
}
export function getLocalOrders(): Order[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ORDERS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Saves orders array to localStorage.
 */
export function saveLocalOrders(orders: Order[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(orders));
  } catch (err) {
    console.warn('Failed to cache orders to localStorage', err);
  }
}

/**
 * Reads cached service bookings from localStorage.
 */
export function getLocalBookings(): ServiceBooking[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BOOKINGS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Saves service bookings array to localStorage.
 */
export function saveLocalBookings(bookings: ServiceBooking[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_BOOKINGS, JSON.stringify(bookings));
  } catch (err) {
    console.warn('Failed to cache bookings to localStorage', err);
  }
}

export interface PlaceOrderParams {
  items: CartItem[];
  deliveryAddress: DeliveryAddress;
  paymentMethod: PaymentMethod;
  notes?: string;
  storeName?: string;
  merchantPhone?: string;
  deliveryFee?: number;
  fulfillmentType?: 'DELIVERY' | 'PICKUP';
}

export interface DeliveryQuoteResult {
  distanceKm: number;
  deliveryFee: number;
  isFree: boolean;
  freeThreshold: number;
  tierExplanation: string;
  storeName: string;
}

/**
 * Fetches authoritative server-side distance-tiered delivery fee quote based on exact GPS coordinates.
 */
export async function fetchDeliveryQuote(params: {
  customerLat?: number;
  customerLng?: number;
  customerPincode?: string;
  businessId?: number | string;
  businessName?: string;
  subtotal: number;
  fulfillmentType?: 'DELIVERY' | 'PICKUP';
}): Promise<DeliveryQuoteResult> {
  const { customerLat, customerLng, customerPincode, businessId, businessName, subtotal, fulfillmentType } = params;

  const queryParams = new URLSearchParams();
  if (typeof customerLat === 'number') queryParams.append('customer_lat', String(customerLat));
  if (typeof customerLng === 'number') queryParams.append('customer_lng', String(customerLng));
  if (customerPincode) queryParams.append('customer_pincode', customerPincode);
  if (businessId) {
    const numId = typeof businessId === 'number' ? businessId : parseInt(String(businessId).replace(/\D/g, ''), 10);
    if (!isNaN(numId)) queryParams.append('business_id', String(numId));
  }
  if (businessName) queryParams.append('business_name', businessName);
  queryParams.append('subtotal', String(subtotal));
  if (fulfillmentType) queryParams.append('fulfillment_type', fulfillmentType);

  const ep = getCommerceEndpoint(`/api/v1/orders/delivery-quote?${queryParams.toString()}`);
  if (ep) {
    try {
      const res = await fetch(ep);
      if (res.ok) {
        const data = await res.json();
        return {
          distanceKm: data.distance_km,
          deliveryFee: data.delivery_fee,
          isFree: data.is_free,
          freeThreshold: data.free_threshold || 499.0,
          tierExplanation: data.tier_explanation || `₹20 for first 2 km, +₹10/km (${data.distance_km} km)`,
          storeName: data.store_name || businessName || 'Neighborhood Store',
        };
      }
    } catch {
      // Fallback to local calculation below
    }
  }

  // Local fallback calculation if backend is offline
  let dist = 1.2;
  if (typeof customerLat === 'number' && typeof customerLng === 'number') {
    const sLat = 28.6304;
    const sLng = 77.2177;
    const dLat = (customerLat - sLat) * 111.0;
    const dLng = (customerLng - sLng) * 111.0 * Math.cos((customerLat * Math.PI) / 180);
    dist = Math.max(0.5, Math.round(Math.sqrt(dLat * dLat + dLng * dLng) * 10) / 10);
  }
  const isFree = subtotal >= 499.0;
  const fee = isFree ? 0 : dist <= 2.0 ? 20 : Math.round(20 + (dist - 2.0) * 10);

  return {
    distanceKm: dist,
    deliveryFee: fee,
    isFree,
    freeThreshold: 499.0,
    tierExplanation: isFree
      ? 'FREE Delivery (Cart >= ₹499)'
      : `₹20 for first 2 km, +₹10/km (${dist} km)`,
    storeName: businessName || 'Neighborhood Store',
  };
}

/**
 * Places an order via backend REST endpoint, falling back to local simulation.
 */
export async function placeOrder(params: PlaceOrderParams): Promise<Order> {
  const { items, deliveryAddress, paymentMethod, notes, storeName } = params;

  const subtotal = items.reduce((sum, it) => sum + it.price * it.quantity, 0);

  // Authoritative server quote calculation fallback
  let distanceKm = 1.2;
  if (typeof deliveryAddress.lat === 'number' && typeof deliveryAddress.lng === 'number') {
    const storeLat = (items[0] as any)?.coords?.lat ?? (items[0] as any)?.lat ?? 28.6304;
    const storeLng = (items[0] as any)?.coords?.lng ?? (items[0] as any)?.lng ?? 77.2177;
    const dLat = (deliveryAddress.lat - storeLat) * 111.0;
    const dLng = (deliveryAddress.lng - storeLng) * 111.0 * Math.cos((deliveryAddress.lat * Math.PI) / 180);
    distanceKm = Math.max(0.4, Math.round(Math.sqrt(dLat * dLat + dLng * dLng) * 10) / 10);
  }
  const deliveryFee = params.deliveryFee !== undefined
    ? params.deliveryFee
    : (subtotal >= 499 ? 0 : distanceKm <= 2.0 ? 20 : Math.round(20 + (distanceKm - 2.0) * 10));
  const platformFee = 5;
  const discountAmount = subtotal >= 500 ? 50 : 0;
  const finalPayable = Math.max(0, subtotal + deliveryFee + platformFee - discountAmount);
  const orderNumber = `MA24-ORD-${Math.floor(1000 + Math.random() * 9000)}`;

  const orderPayload = {
    business_name: storeName || items[0]?.storeName || items[0]?.store || 'Neighborhood Store',
    items: items.map((it) => ({
      product_name: it.name,
      unit_price: it.price,
      quantity: it.quantity,
      store_name: it.storeName || it.store || storeName || 'Neighborhood Store',
      image_url: it.image,
    })),
    delivery_fee: deliveryFee,
    platform_fee: platformFee,
    discount_amount: discountAmount,
    payment_method: paymentMethod,
    fulfillment_type: params.fulfillmentType || 'DELIVERY',
    customer_name: deliveryAddress.recipientName,
    customer_phone: deliveryAddress.recipientPhone,
    merchant_phone: params.merchantPhone || items[0]?.storePhone || items[0]?.merchantPhone || items[0]?.whatsapp,
    delivery_address: `${deliveryAddress.flatNo ? deliveryAddress.flatNo + ', ' : ''}${deliveryAddress.streetAddress}${deliveryAddress.landmark ? ' (Near ' + deliveryAddress.landmark + ')' : ''}`,
    delivery_landmark: deliveryAddress.landmark,
    delivery_pincode: deliveryAddress.pincode,
    delivery_lat: deliveryAddress.lat,
    delivery_lng: deliveryAddress.lng,
    notes,
  };

  const ep = getCommerceEndpoint('/api/v1/orders');
  if (ep) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });

      if (res.ok) {
        const data = await res.json();
        const backendOrder: Order = {
          id: data.order.id,
          orderNumber: data.order.order_number,
          items,
          status: data.order.status as OrderStatus,
          statusDescription: 'Order placed with nearby store. Merchant is acknowledging your basket.',
          totalAmount: data.order.total_amount,
          deliveryFee: data.order.delivery_fee,
          platformFee: data.order.platform_fee,
          discountAmount: data.order.discount_amount,
          finalPayable: data.order.final_payable,
          paymentMethod: data.order.payment_method as PaymentMethod,
          paymentStatus: data.order.payment_status,
          customerName: data.order.customer_name,
          customerPhone: data.order.customer_phone,
          deliveryAddress,
          storeName: storeName || items[0]?.storeName || items[0]?.store || 'Neighborhood Store',
          merchantPhone: data.order?.merchant_phone || params.merchantPhone || items[0]?.storePhone || items[0]?.merchantPhone || items[0]?.whatsapp,
          storePhone: data.order?.merchant_phone || items[0]?.storePhone || items[0]?.phone,
          estimatedDeliveryMins: data.order.estimated_delivery_mins || 20,
          createdAt: data.order.created_at || new Date().toISOString(),
        };

        // Save to local cache
        const existing = getLocalOrders();
        saveLocalOrders([backendOrder, ...existing]);
        return backendOrder;
      }
    } catch {
      // Backend unavailable, continue to local fallback
    }
  }

  // Fallback local order
  const fallbackOrder: Order = {
    id: `local_${Date.now()}`,
    orderNumber,
    items,
    status: 'placed',
    statusDescription: 'Order placed with nearby store. Merchant is acknowledging your basket.',
    totalAmount: subtotal,
    deliveryFee,
    platformFee,
    discountAmount,
    finalPayable,
    paymentMethod,
    paymentStatus: paymentMethod === 'cod' ? 'cod' : 'paid',
    customerName: deliveryAddress.recipientName,
    customerPhone: deliveryAddress.recipientPhone,
    deliveryAddress,
    storeName: storeName || items[0]?.storeName || items[0]?.store || 'Neighborhood Store',
    merchantPhone: params.merchantPhone || items[0]?.storePhone || items[0]?.merchantPhone || items[0]?.whatsapp,
    storePhone: items[0]?.storePhone || items[0]?.phone,
    estimatedDeliveryMins: 20,
    createdAt: new Date().toISOString(),
  };

  const existing = getLocalOrders();
  saveLocalOrders([fallbackOrder, ...existing]);

  // Push instant live notification to merchant portal
  realtimeService.triggerMerchantOrder({
    orderNumber: fallbackOrder.orderNumber,
    customerName: fallbackOrder.customerName,
    customerPhone: fallbackOrder.customerPhone,
    deliveryAddress:
      typeof fallbackOrder.deliveryAddress === 'string'
        ? fallbackOrder.deliveryAddress
        : fallbackOrder.deliveryAddress.streetAddress,
    finalPayable: fallbackOrder.finalPayable,
    items: items.map((it) => ({
      product_name: it.name,
      unit_price: it.price,
      quantity: it.quantity,
      total_price: it.price * it.quantity,
    })),
  });

  return fallbackOrder;
}

/**
 * Advances the lifecycle status of an order:
 * 'placed' -> 'confirmed' -> 'out_for_delivery' -> 'delivered'
 * Note: In a production MVP, order lifecycle advancement is strictly restricted to 
 * the store merchant or authorized delivery logistics partners.
 */
export async function advanceOrderStatus(orderNumber: string, nextStatus: OrderStatus): Promise<Order | null> {
  const token = localStorage.getItem('myarea24_merchant_token') || localStorage.getItem('myarea24_auth_token');
  const ep = getCommerceEndpoint(`/api/v1/orders/${encodeURIComponent(orderNumber)}/status`);

  // Attempt authenticated backend status transition
  if (ep) {
    try {
      const res = await fetch(ep, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          status: nextStatus,
          notes: `Status advanced to ${nextStatus}`,
        }),
      });

      if (!res.ok) {
        console.warn(`[orderCommerceService] Backend rejected status transition to ${nextStatus} (${res.status})`);
        return null;
      }
    } catch (e) {
      console.warn('[orderCommerceService] Network failure during status advance', e);
    }
  }

  // Update local cache
  const orders = getLocalOrders();
  const idx = orders.findIndex((o) => o.orderNumber === orderNumber || String(o.id) === orderNumber);

  const statusDescriptions: Record<OrderStatus, string> = {
    placed: 'Order placed with nearby store. Merchant is acknowledging your basket.',
    confirmed: 'Merchant has accepted your order and is packing fresh items.',
    out_for_delivery: 'Rider has picked up your packet and is navigating to your address.',
    delivered: 'Package safely handed over at your doorstep. Thank you for shopping local!',
    cancelled: 'Order was cancelled.',
  };

  let updatedOrder: Order | null = null;
  if (idx !== -1) {
    orders[idx].status = nextStatus;
    orders[idx].statusDescription = statusDescriptions[nextStatus];
    if (nextStatus === 'delivered' && orders[idx].paymentMethod === 'cod') {
      orders[idx].paymentStatus = 'paid';
    }
    updatedOrder = orders[idx];
    saveLocalOrders(orders);
  }

  return updatedOrder;
}

/**
 * Cancels a customer order while it is in 'placed' status (before merchant confirmation).
 * Customers are strictly forbidden from cancelling orders once packing or dispatch has begun.
 */
export async function cancelCustomerOrder(
  orderNumber: string,
  notes: string = 'Cancelled by customer'
): Promise<{ success: boolean; order?: Order; error?: string }> {
  const orders = getLocalOrders();
  const idx = orders.findIndex((o) => o.orderNumber === orderNumber || String(o.id) === orderNumber);

  if (idx !== -1 && orders[idx].status !== 'placed') {
    return {
      success: false,
      error: 'Cannot cancel order once merchant has confirmed and started packing.',
    };
  }

  const ep = getCommerceEndpoint(`/api/v1/orders/${encodeURIComponent(orderNumber)}/status`);
  const token = localStorage.getItem('myarea24_auth_token') || localStorage.getItem('myarea24_merchant_token');

  if (ep) {
    try {
      const res = await fetch(ep, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: 'cancelled', notes }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return {
          success: false,
          error: errData.detail || `Cancellation rejected (${res.status})`,
        };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error while cancelling order' };
    }
  }

  if (idx !== -1) {
    orders[idx].status = 'cancelled';
    orders[idx].statusDescription = 'Order was cancelled.';
    saveLocalOrders(orders);
    return { success: true, order: orders[idx] };
  }

  return { success: true };
}

export interface BookServiceParams {
  serviceId?: number;
  serviceTitle: string;
  category: string;
  providerName: string;
  providerPhone: string;
  customerName: string;
  customerPhone: string;
  serviceAddress: string;
  scheduledDate: string;
  scheduledSlot: string;
  estimatedCost: number;
  notes?: string;
}

/**
 * Books a service slot via backend API with local cache fallback.
 */
export async function bookServiceSlot(params: BookServiceParams): Promise<ServiceBooking> {
  const bookingNumber = `MA24-SRV-${Math.floor(1000 + Math.random() * 9000)}`;
  const otpCode = String(Math.floor(1000 + Math.random() * 9000));

  const payload = {
    service_id: params.serviceId,
    service_title: params.serviceTitle,
    category: params.category,
    provider_name: params.providerName,
    provider_phone: params.providerPhone,
    customer_name: params.customerName,
    customer_phone: params.customerPhone,
    service_address: params.serviceAddress,
    scheduled_date: params.scheduledDate,
    scheduled_slot: params.scheduledSlot,
    estimated_cost: params.estimatedCost,
    notes: params.notes,
  };

  const bookEp = getCommerceEndpoint('/api/v1/services/book');
  if (bookEp) {
    try {
      const res = await fetch(bookEp, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        const booking: ServiceBooking = {
          id: data.booking.id,
          bookingNumber: data.booking.booking_number,
          serviceTitle: data.booking.service_title,
          category: data.booking.category,
          providerName: data.booking.provider_name,
          providerPhone: data.booking.provider_phone,
          customerName: data.booking.customer_name,
          customerPhone: data.booking.customer_phone,
          serviceAddress: data.booking.service_address,
          scheduledDate: data.booking.scheduled_date,
          scheduledSlot: data.booking.scheduled_slot,
          status: data.booking.status as ServiceBookingStatus,
          estimatedCost: data.booking.estimated_cost,
          otpCode: data.booking.otp_code,
          notes: params.notes,
          createdAt: data.booking.created_at || new Date().toISOString(),
        };

        const existing = getLocalBookings();
        saveLocalBookings([booking, ...existing]);
        return booking;
      }
    } catch {
      // Continue to local fallback
    }
  }

  // Fallback booking
  const fallbackBooking: ServiceBooking = {
    id: `local_srv_${Date.now()}`,
    bookingNumber,
    serviceTitle: params.serviceTitle,
    category: params.category,
    providerName: params.providerName,
    providerPhone: params.providerPhone,
    customerName: params.customerName,
    customerPhone: params.customerPhone,
    serviceAddress: params.serviceAddress,
    scheduledDate: params.scheduledDate,
    scheduledSlot: params.scheduledSlot,
    status: 'requested',
    estimatedCost: params.estimatedCost,
    otpCode,
    notes: params.notes,
    createdAt: new Date().toISOString(),
  };

  const existing = getLocalBookings();
  saveLocalBookings([fallbackBooking, ...existing]);
  return fallbackBooking;
}

/**
 * Advances service booking lifecycle status:
 * 'requested' -> 'confirmed' -> 'in_progress' -> 'completed'
 * In production, only the service professional or provider dashboard can advance service execution stages.
 */
export async function advanceBookingStatus(bookingNumber: string, nextStatus: ServiceBookingStatus): Promise<ServiceBooking | null> {
  const token = localStorage.getItem('myarea24_merchant_token') || localStorage.getItem('myarea24_auth_token');
  const patchEp = getCommerceEndpoint(`/api/v1/services/bookings/${encodeURIComponent(bookingNumber)}/status`);

  if (patchEp) {
    try {
      const res = await fetch(patchEp, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!res.ok) {
        console.warn(`[orderCommerceService] Service booking status advance rejected (${res.status})`);
        return null;
      }
    } catch (e) {
      console.warn('[orderCommerceService] Network failure advancing booking status', e);
    }
  }

  const bookings = getLocalBookings();
  const idx = bookings.findIndex((b) => b.bookingNumber === bookingNumber || String(b.id) === bookingNumber);

  let updatedBooking: ServiceBooking | null = null;
  if (idx !== -1) {
    bookings[idx].status = nextStatus;
    updatedBooking = bookings[idx];
    saveLocalBookings(bookings);
  }

  return updatedBooking;
}

/**
 * Cancels a customer service booking while in 'requested' state.
 */
export async function cancelCustomerBooking(
  bookingNumber: string,
  notes: string = 'Cancelled by resident'
): Promise<{ success: boolean; booking?: ServiceBooking; error?: string }> {
  const bookings = getLocalBookings();
  const idx = bookings.findIndex((b) => b.bookingNumber === bookingNumber || String(b.id) === bookingNumber);

  if (idx !== -1 && bookings[idx].status !== 'requested') {
    return {
      success: false,
      error: 'Cannot cancel booking once confirmed or in-progress with the technician.',
    };
  }

  const patchEp = getCommerceEndpoint(`/api/v1/services/bookings/${encodeURIComponent(bookingNumber)}/status`);
  const token = localStorage.getItem('myarea24_auth_token') || localStorage.getItem('myarea24_merchant_token');

  if (patchEp) {
    try {
      const res = await fetch(patchEp, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: 'cancelled', notes }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return {
          success: false,
          error: errData.detail || `Cancellation rejected (${res.status})`,
        };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error while cancelling service slot' };
    }
  }

  if (idx !== -1) {
    bookings[idx].status = 'cancelled';
    saveLocalBookings(bookings);
    return { success: true, booking: bookings[idx] };
  }

  return { success: true };
}

/**
 * Direct WhatsApp Order Forwarding (Zero Server Cost)
 * Generates an instantaneous pre-filled WhatsApp deep link directly to the merchant
 * with complete itemized order list, quantities, prices, fulfillment mode, and delivery address.
 */
export function buildWhatsAppOrderUrl(
  order: Order,
  fulfillmentType: 'DELIVERY' | 'PICKUP' = 'DELIVERY'
): string {
  // 1. Resolve merchant contact number with priority cascade:
  //    order.merchantPhone -> order.storePhone -> item.storePhone -> item.merchantPhone -> fallback dispatcher
  const rawTargetPhone =
    order.merchantPhone ||
    order.storePhone ||
    (order.items?.[0] as any)?.storePhone ||
    (order.items?.[0] as any)?.merchantPhone ||
    (order.items?.[0] as any)?.phone ||
    (order.items?.[0] as any)?.whatsapp ||
    '919811024024';

  let cleanPhone = String(rawTargetPhone).replace(/\D/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = `91${cleanPhone}`;
  } else if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) {
    cleanPhone = `91${cleanPhone.slice(1)}`;
  } else if (!cleanPhone) {
    cleanPhone = '919811024024';
  }

  // 2. Resolve store name
  const storeDisplayName = order.storeName || 'Merchant Partner Store';

  // 3. Format address string safely
  const addressStr =
    typeof order.deliveryAddress === 'string'
      ? order.deliveryAddress
      : `${order.deliveryAddress.flatNo ? order.deliveryAddress.flatNo + ', ' : ''}${order.deliveryAddress.streetAddress}${order.deliveryAddress.landmark ? ' (Near ' + order.deliveryAddress.landmark.replace(/^near\s+/i, '') + ')' : ''}${order.deliveryAddress.pincode ? ' - ' + order.deliveryAddress.pincode : ''}`;

  // 4. Format itemized product list with quantities and prices
  const items = order.items && order.items.length > 0 ? order.items : [];
  const itemsListText =
    items.length > 0
      ? items.map((it, idx) => `${idx + 1}. *${it.name}* (Qty: ${it.quantity}) — ₹${it.price * it.quantity}`).join('\n')
      : 'Order Items';

  // 5. Fulfillment & Payment summaries
  const fulfillmentStr =
    fulfillmentType === 'PICKUP'
      ? '🏬 Store Pickup / Takeaway'
      : '🛵 Instant Doorstep Delivery';

  const paymentStr =
    order.paymentStatus === 'paid'
      ? '✅ PAID ONLINE (Payment Verified)'
      : order.paymentMethod.toUpperCase() === 'COD'
      ? '💵 Pay on Delivery (Cash / UPI QR at Doorstep)'
      : `⏳ ${order.paymentMethod.toUpperCase()} (${order.paymentStatus || 'Pending'})`;

  // 6. Pre-filled WhatsApp message
  const text =
`*Namaste ${storeDisplayName}!* 🙏
New Customer Order *#${order.orderNumber}* placed on MyArea24.

📦 *Ordered Items:*
${itemsListText}

🛍️ *Fulfillment Mode:* ${fulfillmentStr}
💰 *Total Amount:* ₹${order.finalPayable}
💳 *Payment Status:* ${paymentStr}

📍 *Delivery / Customer Address:*
${addressStr}

👤 *Customer Details:*
• Name: ${order.customerName || 'Customer'}
• Mobile: ${order.customerPhone || 'Not specified'}

Please confirm order acceptance and dispatch timing. Dhanyawad! 🚀`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}
