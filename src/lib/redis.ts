import { Redis } from "@upstash/redis";

let redisClient: Redis | null | undefined;

/**
 * Lazy Redis client for distributed rate-limiting & dedupe.
 * Returns null when env is not configured (local dev fallback to in-memory Maps).
 * Supports both Upstash REST and Vercel KV env names.
 */
export function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;

  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    process.env.REDIS_REST_URL ||
    "";
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.REDIS_REST_TOKEN ||
    "";

  if (!url || !token) {
    redisClient = null;
    return redisClient;
  }

  try {
    redisClient = new Redis({ url, token });
    return redisClient;
  } catch {
    redisClient = null;
    return redisClient;
  }
}

export function isRedisEnabled(): boolean {
  return getRedis() !== null;
}
