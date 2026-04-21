/**
 * Per-org sliding-window rate limiter for the AI gateway.
 *
 * Default: 1000 requests/hour per org. Enforced in Redis via a sorted-set
 * sliding window (ZREMRANGEBYSCORE + ZCARD + ZADD + EXPIRE). Falls back to
 * an in-memory Map when Redis is unavailable so the gateway never hard-blocks
 * on infrastructure issues.
 *
 * Returns false and writes HTTP 429 when the limit is exceeded.
 */

import type { Request, Response } from 'express';
import { getRedisClient } from '../lib/redis-client';
import { logger } from '../lib/logger';

const ORG_RATE_LIMIT_PER_HOUR = Number(process.env.ORG_RATE_LIMIT_PER_HOUR ?? 1000);
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const WINDOW_S = 60 * 60;

// In-memory fallback when Redis is unavailable
const fallbackWindows = new Map<string, { timestamps: number[] }>();

function fallbackCheck(orgId: string): boolean {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const entry = fallbackWindows.get(orgId) ?? { timestamps: [] };
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
  if (entry.timestamps.length >= ORG_RATE_LIMIT_PER_HOUR) {
    fallbackWindows.set(orgId, entry);
    return false;
  }
  entry.timestamps.push(now);
  fallbackWindows.set(orgId, entry);
  return true;
}

export async function checkOrgRateLimit(
  req: Request,
  res: Response,
  orgId: string,
): Promise<boolean> {
  const redis = await getRedisClient();

  let allowed = true;
  let remaining = ORG_RATE_LIMIT_PER_HOUR - 1;

  if (redis) {
    try {
      const key = `org_rl:${orgId}`;
      const now = Date.now();
      const cutoff = now - WINDOW_MS;
      const member = `${now}-${Math.random().toString(36).slice(2)}`;

      const [, , count] = await redis
        .multi()
        .zremrangebyscore(key, '-inf', cutoff)
        .zadd(key, now, member)
        .zcard(key)
        .expire(key, WINDOW_S + 10)
        .exec() as [null, null, number, null][];

      const currentCount = typeof count === 'number' ? count : ORG_RATE_LIMIT_PER_HOUR;
      remaining = Math.max(0, ORG_RATE_LIMIT_PER_HOUR - currentCount);

      if (currentCount > ORG_RATE_LIMIT_PER_HOUR) {
        // undo the just-added member
        await redis.zrem(key, member).catch(() => null);
        allowed = false;
      }
    } catch (err: any) {
      logger.warn('orgRateLimiter: Redis error, falling back to in-memory', { err: err?.message });
      allowed = fallbackCheck(orgId);
    }
  } else {
    allowed = fallbackCheck(orgId);
  }

  res.setHeader('X-RateLimit-Limit', String(ORG_RATE_LIMIT_PER_HOUR));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, remaining)));
  res.setHeader('X-RateLimit-Window', '3600');

  if (!allowed) {
    res.status(429).json({
      error: {
        message: `Your organization has exceeded ${ORG_RATE_LIMIT_PER_HOUR} requests per hour. Please wait before sending more requests, or upgrade your plan for a higher limit.`,
        type: 'rate_limit_error',
        code: 'org_rate_limit_exceeded',
      },
    });
  }

  return allowed;
}
