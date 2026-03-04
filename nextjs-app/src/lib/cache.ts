import { getRedisClient } from "./redis";

const DEFAULT_TTL = 300;

export async function getCached<T>(key: string, fetcher: () => Promise<T>, ttl: number = DEFAULT_TTL): Promise<T> {
  const redis = getRedisClient();
  try {
    const cached = await redis.get(`cache:${key}`);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch {
    // Cache miss or error, fall through to fetcher
  }

  const data = await fetcher();

  try {
    await redis.set(`cache:${key}`, JSON.stringify(data), "EX", ttl);
  } catch {
    // Ignore cache write failures
  }

  return data;
}

export async function invalidateCache(key: string): Promise<void> {
  const redis = getRedisClient();
  try {
    await redis.del(`cache:${key}`);
  } catch {
    // Ignore cache invalidation failures
  }
}
