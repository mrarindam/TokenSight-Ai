/**
 * ANONYMOUS SCAN TRACKING SYSTEM (V2: DAILY BUDGET)
 * Purpose: Track and limit scans for unauthenticated users using localStorage.
 */

const SCAN_LIMIT = 5;
const STORAGE_KEY = "anon_scan_count_daily";
const DATE_KEY = "anon_scan_last_date";

export const getAnonScanCount = (): number => {
  if (typeof window === "undefined") return 0;
  
  // Check if date has changed
  const today = new Date().toISOString().split('T')[0];
  const lastDate = localStorage.getItem(DATE_KEY);
  
  if (lastDate !== today) {
    localStorage.setItem(DATE_KEY, today);
    localStorage.setItem(STORAGE_KEY, "0");
    return 0;
  }

  const count = localStorage.getItem(STORAGE_KEY);
  return count ? parseInt(count, 10) : 0;
};

export const incrementAnonScanCount = (): number => {
  if (typeof window === "undefined") return 0;
  
  const current = getAnonScanCount();
  const next = current + 1;
  
  localStorage.setItem(STORAGE_KEY, next.toString());
  return next;
};

export const isAnonLimitReached = (): boolean => {
  return getAnonScanCount() >= SCAN_LIMIT;
};

export const getRemainingScans = (): number => {
  return Math.max(0, SCAN_LIMIT - getAnonScanCount());
};

export const resetAnonScanCount = (): void => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(DATE_KEY);
};

export const SCAN_CONFIG = {
  LIMIT: SCAN_LIMIT,
  THRESHOLD_ANIMATE: 2, // Start animating when 2 scans left
};
