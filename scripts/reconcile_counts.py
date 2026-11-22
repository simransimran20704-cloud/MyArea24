import sqlite3

earlier = {
    'users': 20, 'data_sources': 5, 'data_sync_logs': 901, 'emergency_facilities': 251,
    'businesses': 90, 'products': 4, 'service_listings': 16, 'offers': 0, 'events': 103,
    'orders': 16, 'order_items': 16, 'service_bookings': 1, 'customer_enquiries': 0,
    'merchant_push_subscriptions': 1, 'saved_items': 0, 'otp_tokens': 37,
    'intelligence_insights': 30, 'intelligence_signals': 32, 'air_quality_observations': 50,
    'weather_observations': 1855, 'traffic_observations': 1569, 'government_notices': 124,
    'mandi_prices': 633, 'civic_bulletins': 0, 'community_signals': 0, 'analytics_events': 4,
    'api_usage_records': 645, 'fuel_price_records': 56, 'fuel_stations': 350,
    'government_housing_indices': 14, 'hospital_directory': 380, 'petrol_pumps': 242,
    'rental_listings': 133, 'residential_macro_indices': 90, 'saved_routes': 2,
    'user_consent_records': 0
}

backup_path = 'backups/myarea24_backup_consistent_20261122_233928_restore_test.db'
conn = sqlite3.connect(f'file:{backup_path}?mode=ro', uri=True)
cur = conn.cursor()

diffs = []
current_counts = {}
for t in earlier:
    c = cur.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
    current_counts[t] = c
    if c != earlier[t]:
        diffs.append((t, earlier[t], c, c - earlier[t]))

print("=" * 60)
print(f"Record Count Reconciliation between earlier dry-run and latest backup ({backup_path}):")
print("=" * 60)
for d in diffs:
    print(f"  {d[0]:25}: earlier {d[1]:4} -> latest {d[2]:4} (delta: +{d[3]})")
print("-" * 60)
print(f"Total Earlier: {sum(earlier.values()):,} | Total Latest: {sum(current_counts.values()):,} | Net Delta: +{sum(current_counts.values()) - sum(earlier.values())}")
print("=" * 60)
print("\nAll 36 Tables Current Backup Counts:")
for t, c in sorted(current_counts.items()):
    print(f"  {t:30}: {c:5} rows")
conn.close()
