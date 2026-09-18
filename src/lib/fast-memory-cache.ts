/**
 * High-performance, lightweight in-memory cache for high-traffic read routes.
 * Caches responses per tenant with short TTL to eliminate database round-trips
 * while keeping academic data fresh.
 */
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class FastMemoryCache {
  private store = new Map<string, CacheEntry<any>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlSeconds: number = 60): void {
    // Unbounded growth prevention
    if (this.store.size > 5000) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }
}

export const fastCache = new FastMemoryCache();
