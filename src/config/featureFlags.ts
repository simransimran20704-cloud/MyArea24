/**
 * Feature Flags Configuration for MyArea24
 *
 * Centralized registry for toggling features across the platform.
 * All feature implementations, UI modules, API integrations, and database logic
 * are preserved and can be reactivated by changing the corresponding flag.
 */

export const FEATURE_FLAGS = {
  /**
   * Residential Rental Benchmark feature:
   * When false (Disabled):
   * - Completely hides the Residential Rental Benchmark section from the website interface.
   * - Hides the 'Property & Rentals' tab and rental benchmarks from Market & Fuel Rates.
   * - Removes navigation links, menu items, dashboard cards, buttons, and visible entry points.
   * - Blocks direct frontend navigation to existing rental benchmark routes, redirecting to home.
   * - Preserves all underlying components (ResidentialBenchmarkModule.tsx), models, and backend APIs.
   *
   * To re-enable the feature in the future, set this flag to `true`.
   */
  ENABLE_RESIDENTIAL_RENTAL_BENCHMARK: false,
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

export const isFeatureEnabled = (flag: FeatureFlagKey): boolean => {
  return Boolean(FEATURE_FLAGS[flag]);
};
