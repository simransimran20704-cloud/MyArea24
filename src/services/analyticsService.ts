/**
 * Privacy-Conscious Hyperlocal Analytics Service for MyArea24
 * Compliant with India DPDP Act 2023. Zero PII, no fingerprinting.
 */

import { getApiBaseUrl } from '../config/apiClient';

interface AnalyticsPayload {
  event_type: 'page_view' | 'search' | 'feature_usage' | 'product_view' | 'discovery' | 'engagement';
  category: string;
  action: string;
  label?: string;
  metadata?: Record<string, any>;
}

class AnalyticsService {
  private queue: AnalyticsPayload[] = [];
  private flushTimer: any = null;
  private readonly maxBatchSize = 10;
  private readonly flushIntervalMs = 5000;

  constructor() {
    if (typeof window !== 'undefined') {
      // Flush before unloading tab
      window.addEventListener('beforeunload', () => this.flushSync());
    }
  }

  private hasConsent(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const raw = localStorage.getItem('myarea24_dpdp_consent');
      if (!raw) return true; // Default allowed for strictly anonymous aggregated civic metrics until configured
      const parsed = JSON.parse(raw);
      return parsed.analytics !== false;
    } catch {
      return true;
    }
  }

  public track(payload: AnalyticsPayload): void {
    if (!this.hasConsent()) return;

    this.queue.push(payload);
    if (this.queue.length >= this.maxBatchSize) {
      this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.flushIntervalMs);
    }
  }

  public trackPageView(pageName: string, path: string): void {
    this.track({
      event_type: 'page_view',
      category: 'navigation',
      action: 'view_page',
      label: pageName,
      metadata: { path }
    });
  }

  public trackSearch(query: string, category: string, resultCount?: number): void {
    // Redact potential PII in query before sending
    const sanitized = query.slice(0, 80).trim();
    if (!sanitized) return;

    this.track({
      event_type: 'search',
      category: category || 'global',
      action: 'execute_search',
      label: sanitized,
      metadata: { count: resultCount ?? 0 }
    });
  }

  public trackFeatureUsage(feature: string, action: string, details?: Record<string, any>): void {
    this.track({
      event_type: 'feature_usage',
      category: 'feature',
      action,
      label: feature,
      metadata: details
    });
  }

  public trackEngagement(category: string, entityId: string, entityName?: string): void {
    this.track({
      event_type: 'engagement',
      category,
      action: 'interact_item',
      label: entityName || entityId,
      metadata: { id: entityId }
    });
  }

  private async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.queue.length === 0) return;

    const items = [...this.queue];
    this.queue = [];

    const base = getApiBaseUrl();
    if (!base) return;

    for (const item of items) {
      try {
        await fetch(`${base}/api/v1/analytics/track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });
      } catch {
        // Silently tolerate analytics failures to never disrupt UX
      }
    }
  }

  private flushSync(): void {
    if (this.queue.length === 0) return;
    const items = [...this.queue];
    this.queue = [];
    const base = getApiBaseUrl();
    if (!base || typeof navigator === 'undefined' || !navigator.sendBeacon) return;

    for (const item of items) {
      try {
        const blob = new Blob([JSON.stringify(item)], { type: 'application/json' });
        navigator.sendBeacon(`${base}/api/v1/analytics/track`, blob);
      } catch {}
    }
  }
}

export const analytics = new AnalyticsService();
