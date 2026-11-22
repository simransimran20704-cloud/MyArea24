// MyArea24 Service Worker — Background Order Alerts & Audio Chime on Sleep/Locked Screen
const SW_VERSION = 'myarea24-sw-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Prune outdated caches if any
      caches.keys().then((keys) =>
        Promise.all(
          keys.filter((k) => k !== SW_VERSION).map((k) => caches.delete(k))
        )
      ),
    ])
  );
});

// ==============================================================================
// Web Push Event: Receives server push when mobile screen is asleep / locked
// ==============================================================================
self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload = {
        title: '🛍️ New Order Received!',
        body: event.data.text() || 'A new order has arrived in your storefront.',
      };
    }
  }

  const isOrder = Boolean(payload.orderNumber || payload.type === 'MERCHANT_ORDER');
  const title = payload.title || (isOrder ? `🛍️ New Order #${payload.orderNumber || ''}` : '🔔 MyArea24 Alert');
  const finalPayable = payload.finalPayable ? `₹${payload.finalPayable}` : '';
  const customerName = payload.customerName || 'Customer';

  const body =
    payload.body ||
    (isOrder
      ? `New order ${finalPayable} from ${customerName}. Tap to view items and accept!`
      : 'You have a new update from your local neighborhood store.');

  // High-priority lock screen notification options
  const notificationOptions = {
    body,
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/icon-192.png',
    tag: payload.tag || (payload.orderNumber ? `merchant-order-${payload.orderNumber}` : `notice-${Date.now()}`),
    renotify: true,
    requireInteraction: true,
    silent: false,
    // Multi-pulse cash register chime vibration pattern for mobile lock screens:
    // 300ms buzz, 100ms pause, 300ms buzz, 100ms pause, 300ms buzz, 100ms pause, 500ms long chime
    vibrate: isOrder ? [300, 100, 300, 100, 300, 100, 500] : [200, 100, 200],
    data: {
      url: payload.url || (isOrder ? '/merchant' : '/'),
      orderNumber: payload.orderNumber,
      businessId: payload.businessId,
      finalPayable: payload.finalPayable,
      type: payload.type || (isOrder ? 'MERCHANT_ORDER' : 'GENERAL'),
      timestamp: Date.now(),
    },
    actions: isOrder
      ? [
          { action: 'view_order', title: '👀 View Order' },
          { action: 'dismiss', title: '✕ Dismiss' },
        ]
      : [{ action: 'open', title: 'Open' }],
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, notificationOptions),
      // Broadcast to any open/waking tabs so they play audio chime and update state
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          client.postMessage({
            type: 'PUSH_ORDER_RECEIVED',
            payload: {
              ...payload,
              isOrder,
              notificationOptions,
            },
          });
        }
      }),
    ])
  );
});

// ==============================================================================
// Notification Click Event: Focus or open Merchant Portal & trigger audio
// ==============================================================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/merchant';
  const orderNumber = event.notification.data?.orderNumber;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a merchant tab is already open, focus it and dispatch order focus message
      for (const client of clientList) {
        if (client.url.includes('/merchant') && 'focus' in client) {
          client.postMessage({
            type: 'FOCUS_ORDER',
            orderNumber,
            url: targetUrl,
          });
          return client.focus();
        }
      }
      // Otherwise open a new window to the merchant portal
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// ==============================================================================
// Message Event: Communication from main thread (Test Push, Wake, Skip Waiting)
// ==============================================================================
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data.type === 'TEST_NOTIFICATION') {
    self.registration.showNotification(event.data.title || '🛍️ Test Order Alert — MyArea24', {
      body: event.data.body || 'New order simulation: Audio chime and lock screen vibration verified!',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'test-order-ring',
      renotify: true,
      requireInteraction: true,
      vibrate: [300, 100, 300, 100, 300, 100, 500],
      data: { url: '/merchant', isTest: true },
      actions: [{ action: 'view_order', title: 'Open Merchant Portal' }],
    });
  }
});
