import React, { useState, useEffect } from 'react';
import { X, ShoppingBag, ChevronRight } from 'lucide-react';
import { CartItem, DeliveryAddress, Order, OrderStatus, PaymentMethod, PaymentStatus, UserLocation } from '../types';
import {
  placeOrder,
  cancelCustomerOrder,
  loadRazorpayScript,
  verifyOrderPayment,
  fetchDeliveryQuote,
  DeliveryQuoteResult,
} from '../services/orderCommerceService';
import {
  realtimeService,
  ORDER_STATUS_EVENT,
  LiveOrderStatusEventDetail,
} from '../services/realtimeService';
import { getStoredAuthUser } from '../services/authService';
import { apiClient } from '../config/apiClient';
import { useTranslation } from 'react-i18next';

import { CartItemsReview } from './cart/CartItemsReview';
import { CheckoutAddressForm } from './cart/CheckoutAddressForm';
import { PaymentMethodSelector } from './cart/PaymentMethodSelector';
import { OrderTrackingView } from './cart/OrderTrackingView';
import { CartPriceSummary } from './cart/CartPriceSummary';

export interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  currentLocation: UserLocation;
  onNavigateToMap?: () => void;
  onNavigateToProducts?: () => void;
}

type CheckoutStep = 'review' | 'address' | 'payment' | 'tracking';

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  currentLocation,
  onNavigateToProducts,
}) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<CheckoutStep>('review');
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [isPlacing, setIsPlacing] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Delivery Address Form State
  const [recipientName, setRecipientName] = useState(() => {
    const authUser = getStoredAuthUser();
    if (authUser?.fullName) return authUser.fullName;
    try {
      const saved = localStorage.getItem('myarea24_checkout_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.recipientName) return parsed.recipientName;
      }
    } catch {}
    return '';
  });

  const [recipientPhone, setRecipientPhone] = useState(() => {
    const authUser = getStoredAuthUser();
    if (authUser?.phone) return authUser.phone;
    try {
      const saved = localStorage.getItem('myarea24_checkout_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.recipientPhone) return parsed.recipientPhone;
      }
    } catch {}
    return '';
  });

  const [flatNo, setFlatNo] = useState(() => {
    try {
      const saved = localStorage.getItem('myarea24_checkout_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.flatNo) return parsed.flatNo;
      }
    } catch {}
    return '';
  });

  const [streetAddress, setStreetAddress] = useState(
    currentLocation.fullAddress || currentLocation.areaName || ''
  );

  const [landmark, setLandmark] = useState(() => {
    try {
      const saved = localStorage.getItem('myarea24_checkout_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.landmark) return parsed.landmark;
      }
    } catch {}
    return '';
  });

  const [pincode, setPincode] = useState(() => {
    if (currentLocation.pincode) return currentLocation.pincode;
    try {
      const saved = localStorage.getItem('myarea24_checkout_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.pincode) return parsed.pincode;
      }
    } catch {}
    return '';
  });

  const [gpsVerified, setGpsVerified] = useState(true);
  const [deliveryCoords, setDeliveryCoords] = useState(
    currentLocation.coords || { lat: 28.7196, lng: 77.1186 }
  );
  const [addressError, setAddressError] = useState<string | null>(null);
  const [fulfillmentType, setFulfillmentType] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [serverDeliveryQuote, setServerDeliveryQuote] = useState<DeliveryQuoteResult | null>(null);

  // Authoritative server-side distance-tiered delivery fee quote
  useEffect(() => {
    if (!isOpen || items.length === 0) return;

    let isMounted = true;
    const storeName = items[0]?.store || 'Neighborhood Store';
    const subtotal = items.reduce((acc, it) => acc + it.price * it.quantity, 0);

    const timer = setTimeout(async () => {
      try {
        const quote = await fetchDeliveryQuote({
          customerLat: deliveryCoords.lat,
          customerLng: deliveryCoords.lng,
          customerPincode: pincode || currentLocation.pincode,
          businessName: storeName,
          subtotal,
          fulfillmentType,
        });
        if (isMounted) {
          setServerDeliveryQuote(quote);
        }
      } catch (err) {
        console.debug('Failed to fetch delivery quote', err);
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [
    isOpen,
    items.length,
    items[0]?.price,
    items[0]?.quantity,
    deliveryCoords.lat,
    deliveryCoords.lng,
    pincode,
    currentLocation.pincode,
    items[0]?.store,
    fulfillmentType,
  ]);

  // Sync profile when auth state changes
  useEffect(() => {
    const authUser = getStoredAuthUser();
    if (authUser?.fullName && !recipientName) {
      setRecipientName(authUser.fullName);
    }
    if (authUser?.phone && !recipientPhone) {
      setRecipientPhone(authUser.phone);
    }
  }, [isOpen]);

  const handleProceedToPayment = () => {
    if (fulfillmentType === 'PICKUP') {
      if (!recipientName.trim()) {
        setAddressError('Please enter your full name for store pickup verification.');
        return;
      }
      if (!recipientPhone.trim() || recipientPhone.trim().replace(/\D/g, '').length < 8) {
        setAddressError('Please enter a valid mobile number for pickup notifications.');
        return;
      }
      if (!streetAddress.trim()) {
        setStreetAddress(`Storefront Pickup at ${storeName}`);
      }
      if (!flatNo.trim()) {
        setFlatNo('Pickup Counter');
      }
    } else {
      if (!recipientName.trim()) {
        setAddressError('Please enter the recipient full name.');
        return;
      }
      if (!recipientPhone.trim() || recipientPhone.trim().replace(/\D/g, '').length < 8) {
        setAddressError('Please enter a valid mobile number for delivery verification.');
        return;
      }
      if (!flatNo.trim()) {
        setAddressError('Please specify your flat, floor, or house number.');
        return;
      }
      if (!streetAddress.trim()) {
        setAddressError('Please enter complete street or area address.');
        return;
      }
    }
    setAddressError(null);
    try {
      localStorage.setItem(
        'myarea24_checkout_profile',
        JSON.stringify({ recipientName, recipientPhone, flatNo, landmark, pincode })
      );
    } catch {}
    setStep('payment');
  };

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi_qr');
  const [upiVerified, setUpiVerified] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');

  // Sync address if currentLocation changes and form is unmodified
  useEffect(() => {
    if (currentLocation) {
      setStreetAddress(currentLocation.fullAddress || currentLocation.areaName);
      if (currentLocation.pincode) setPincode(currentLocation.pincode);
      if (currentLocation.coords) setDeliveryCoords(currentLocation.coords);
    }
  }, [currentLocation]);

  // Reset step if closed or cart empties (unless in active tracking)
  useEffect(() => {
    if (!isOpen) {
      if (step !== 'tracking') {
        setStep('review');
      }
    }
  }, [isOpen, step]);

  // Live WebSockets synchronization for active order lifecycle
  const [liveSyncNotice, setLiveSyncNotice] = useState<string | null>(null);

  useEffect(() => {
    if (activeOrder?.orderNumber) {
      realtimeService.subscribeToOrder(activeOrder.orderNumber);

      const handleLiveStatus = (e: any) => {
        const detail = e.detail as LiveOrderStatusEventDetail;
        if (!detail || !detail.orderNumber) return;
        if (detail.orderNumber.toLowerCase() === activeOrder.orderNumber.toLowerCase()) {
          const nextStatus = detail.status as OrderStatus;
          const statusDescriptions: Record<OrderStatus, string> = {
            placed: 'Order placed with nearby store. Merchant is acknowledging your basket.',
            confirmed: 'Merchant has accepted your order and is packing fresh items.',
            out_for_delivery: 'Rider has picked up your packet and is navigating to your address.',
            delivered: 'Package handed over at your doorstep. Thank you for shopping local!',
            cancelled: 'Order was cancelled.',
          };

          setActiveOrder((prev) =>
            prev
              ? {
                  ...prev,
                  status: nextStatus,
                  statusDescription: statusDescriptions[nextStatus] || prev.statusDescription,
                  paymentStatus: (detail.paymentStatus as PaymentStatus) || prev.paymentStatus,
                }
              : null
          );

          setLiveSyncNotice(`🟢 Real-Time Update: Order is now ${nextStatus.replace(/_/g, ' ')}!`);
          setTimeout(() => setLiveSyncNotice(null), 4500);
        }
      };

      window.addEventListener(ORDER_STATUS_EVENT, handleLiveStatus);
      return () => {
        window.removeEventListener(ORDER_STATUS_EVENT, handleLiveStatus);
        realtimeService.unsubscribeFromOrder(activeOrder.orderNumber);
      };
    }
  }, [activeOrder?.orderNumber]);

  if (!isOpen) return null;

  // Calculation helpers & authoritative server-side distance-tiered delivery fee
  const subtotal = items.reduce((acc, it) => acc + it.price * it.quantity, 0);
  const storeName = items[0]?.store || 'Neighborhood Store';
  const distanceKm = serverDeliveryQuote?.distanceKm ?? 1.2;
  const isPickup = fulfillmentType === 'PICKUP';
  const deliveryFee = isPickup || subtotal >= 499 || items.length === 0
    ? 0
    : serverDeliveryQuote?.deliveryFee ?? (distanceKm <= 2.0 ? 20 : Math.round(20 + (distanceKm - 2.0) * 10));
  const platformFee = items.length > 0 ? 5 : 0;
  const discountAmount = subtotal >= 500 ? 50 : 0;
  const grandTotal = Math.max(0, subtotal + deliveryFee + platformFee - discountAmount);

  const handleVerifyGps = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setDeliveryCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGpsVerified(true);
        },
        () => {
          if (currentLocation.coords) {
            setDeliveryCoords(currentLocation.coords);
          }
          setGpsVerified(true);
        }
      );
    } else {
      setGpsVerified(true);
    }
  };

  const handleConfirmOrder = async (overrideMethod?: PaymentMethod, preferUpiSheet?: boolean) => {
    if (!recipientName || !recipientPhone || !streetAddress) {
      alert('Please fill in complete recipient and delivery address details.');
      return;
    }

    const effectiveMethod = overrideMethod || paymentMethod;
    setIsPlacing(true);
    try {
      const addressData: DeliveryAddress = {
        recipientName,
        recipientPhone,
        streetAddress,
        flatNo,
        landmark,
        pincode,
        lat: deliveryCoords.lat,
        lng: deliveryCoords.lng,
        verifiedGps: gpsVerified,
      };

      const order = await placeOrder({
        items,
        deliveryAddress: addressData,
        paymentMethod: effectiveMethod,
        notes: orderNotes,
        storeName,
        deliveryFee,
        fulfillmentType,
      });

      // If Razorpay chosen, trigger Razorpay Standard Checkout SDK
      if (effectiveMethod === 'razorpay') {
        const isLoaded = await loadRazorpayScript();
        const rzpKey = (import.meta as any).env?.VITE_RAZORPAY_KEY_ID || 'rzp_test_MyArea24SimKey';

        if (isLoaded && (window as any).Razorpay) {
          const rzpOptions = {
            key: rzpKey,
            amount: Math.round(order.finalPayable * 100),
            currency: 'INR',
            name: 'MyArea24 Neighbourhood Market',
            description: `Order ${order.orderNumber} • ${storeName}`,
            notes: {
              order_number: order.orderNumber,
            },
            prefill: {
              name: recipientName,
              contact: recipientPhone,
              ...(preferUpiSheet || effectiveMethod === 'razorpay' && paymentMethod === 'upi_qr'
                ? { method: 'upi' }
                : {}),
            },
            theme: {
              color: '#2563eb',
            },
            handler: async (response: any) => {
              try {
                await verifyOrderPayment({
                  orderIdentifier: order.orderNumber,
                  paymentMethod: 'razorpay',
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpayOrderId: response.razorpay_order_id,
                  razorpaySignature: response.razorpay_signature,
                  amount: order.finalPayable,
                });
                order.paymentStatus = 'paid';
                order.transactionId = response.razorpay_payment_id;
              } catch (e) {
                console.warn(
                  '[Payment] Client callback verification failed or timed out; backend webhook will synchronize payment.',
                  e
                );
                if (response?.razorpay_payment_id) {
                  order.transactionId = response.razorpay_payment_id;
                }
              } finally {
                setActiveOrder({ ...order });
                setStep('tracking');
                onClearCart();
                setIsPlacing(false);
              }
            },
            modal: {
              ondismiss: () => {
                setActiveOrder({ ...order });
                setStep('tracking');
                setIsPlacing(false);
                onClearCart();
              },
            },
          };

          const rzpInstance = new (window as any).Razorpay(rzpOptions);
          rzpInstance.open();
          return;
        }
      }

      // If UPI QR, verify transaction reference and record
      if (effectiveMethod === 'upi_qr') {
        await verifyOrderPayment({
          orderIdentifier: order.orderNumber,
          paymentMethod: 'upi_qr',
          upiRefId: `UPI_REF_${Date.now()}`,
        });
        order.paymentStatus = 'paid';
      }

      setActiveOrder(order);
      setStep('tracking');
      onClearCart();
    } catch (err) {
      console.error('Order placement failed', err);
      alert('Could not complete order. Please try again.');
    } finally {
      setIsPlacing(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!activeOrder) return;
    if (activeOrder.status !== 'placed') {
      alert('Orders can only be cancelled while waiting for store confirmation.');
      return;
    }
    if (!window.confirm(`Are you sure you want to cancel Order #${activeOrder.orderNumber}?`)) {
      return;
    }

    setIsCancelling(true);
    setCancelError(null);
    try {
      const res = await cancelCustomerOrder(activeOrder.orderNumber, 'Cancelled by customer before store confirmation');
      if (res.success && res.order) {
        setActiveOrder({ ...res.order });
      } else if (!res.success) {
        setCancelError(res.error || 'Failed to cancel order.');
      }
    } catch (e: any) {
      setCancelError(e.message || 'Error cancelling order.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRefreshOrderStatus = async () => {
    if (!activeOrder) return;
    setIsUpdatingStatus(true);
    try {
      const tokenParam = activeOrder.trackingToken ? `?token=${encodeURIComponent(activeOrder.trackingToken)}` : '';
      const res = await apiClient.get<{ order?: { status: OrderStatus; payment_status?: PaymentStatus } }>(
        `/api/v1/orders/${encodeURIComponent(activeOrder.orderNumber)}${tokenParam}`
      );
      if (res.ok && res.data?.order) {
        setActiveOrder({
          ...activeOrder,
          status: res.data.order.status,
          paymentStatus: res.data.order.payment_status || activeOrder.paymentStatus,
        });
      }
    } catch (e) {
      console.warn('Failed to refresh order status', e);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity"
      />

      {/* Slide-out Panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-250">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  {step === 'review' && `${t('cart.title')} (${items.length})`}
                  {step === 'address' && t('cart.deliveryAddress')}
                  {step === 'payment' && t('cart.selectPayment')}
                  {step === 'tracking' && `${t('cart.orderTracking')} • ${activeOrder?.orderNumber || ''}`}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {step === 'tracking' ? 'Hyperlocal Instant Fulfillment' : `From ${storeName}`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Stepper Header (Only when not in tracking) */}
          {step !== 'tracking' && (
            <div className="px-5 py-2.5 bg-blue-50/50 border-b border-blue-100 flex items-center justify-between text-xs font-bold text-slate-500">
              <span className={`flex items-center gap-1 ${step === 'review' ? 'text-blue-600' : 'text-slate-400'}`}>
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center">1</span>
                Items
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
              <span className={`flex items-center gap-1 ${step === 'address' ? 'text-blue-600' : 'text-slate-400'}`}>
                <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center ${step === 'address' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>2</span>
                Address
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
              <span className={`flex items-center gap-1 ${step === 'payment' ? 'text-blue-600' : 'text-slate-400'}`}>
                <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center ${step === 'payment' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>3</span>
                Payment
              </span>
            </div>
          )}

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {step === 'review' && (
              <CartItemsReview
                items={items}
                storeName={storeName}
                currentLocation={currentLocation}
                orderNotes={orderNotes}
                onUpdateNotes={setOrderNotes}
                onUpdateQuantity={onUpdateQuantity}
                onRemoveItem={onRemoveItem}
                onClearCart={onClearCart}
                onClose={onClose}
                onNavigateToProducts={onNavigateToProducts}
              />
            )}

            {step === 'address' && (
              <CheckoutAddressForm
                fulfillmentType={fulfillmentType}
                onFulfillmentTypeChange={setFulfillmentType}
                distanceKm={distanceKm}
                storeName={storeName}
                gpsVerified={gpsVerified}
                deliveryCoords={deliveryCoords}
                onVerifyGps={handleVerifyGps}
                addressError={addressError}
                onClearAddressError={() => setAddressError(null)}
                recipientName={recipientName}
                onRecipientNameChange={setRecipientName}
                recipientPhone={recipientPhone}
                onRecipientPhoneChange={setRecipientPhone}
                flatNo={flatNo}
                onFlatNoChange={setFlatNo}
                streetAddress={streetAddress}
                onStreetAddressChange={setStreetAddress}
                landmark={landmark}
                onLandmarkChange={setLandmark}
                pincode={pincode}
                onPincodeChange={setPincode}
              />
            )}

            {step === 'payment' && (
              <PaymentMethodSelector
                paymentMethod={paymentMethod}
                onPaymentMethodChange={setPaymentMethod}
                grandTotal={grandTotal}
                storeName={storeName}
                upiVerified={upiVerified}
                onUpiVerified={setUpiVerified}
                onRazorpayIntent={() => handleConfirmOrder('razorpay', true)}
              />
            )}

            {step === 'tracking' && activeOrder && (
              <OrderTrackingView
                activeOrder={activeOrder}
                liveSyncNotice={liveSyncNotice}
                currentLocation={currentLocation}
                items={items}
                fulfillmentType={fulfillmentType}
                isUpdatingStatus={isUpdatingStatus}
                onRefreshStatus={handleRefreshOrderStatus}
                isCancelling={isCancelling}
                cancelError={cancelError}
                onCancelOrder={handleCancelOrder}
              />
            )}
          </div>

          {/* Footer with Price Breakdown and Progression CTA */}
          <CartPriceSummary
            step={step}
            items={items}
            activeOrder={activeOrder}
            fulfillmentType={fulfillmentType}
            subtotal={subtotal}
            distanceKm={distanceKm}
            deliveryFee={deliveryFee}
            platformFee={platformFee}
            discountAmount={discountAmount}
            grandTotal={grandTotal}
            serverDeliveryQuote={serverDeliveryQuote}
            isPlacing={isPlacing}
            onSetStep={setStep}
            onProceedToPayment={handleProceedToPayment}
            onConfirmOrder={() => handleConfirmOrder()}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
};
