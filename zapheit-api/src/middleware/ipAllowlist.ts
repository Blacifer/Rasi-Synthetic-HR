import { Request, Response, NextFunction } from 'express';
import { supabaseRestAsService, eq } from '../lib/supabase-rest';
import { logger } from '../lib/logger';

// Cache org ip_allowlist for 60 seconds to avoid a DB hit on every request.
const cache = new Map<string, { cidrs: string[]; exp: number }>();
const CACHE_TTL_MS = 60_000;

function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) | parseInt(octet, 10), 0) >>> 0;
}

function ipMatchesCidr(ip: string, cidr: string): boolean {
  const [network, bits] = cidr.split('/');
  const prefixLen = parseInt(bits ?? '32', 10);
  const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
  try {
    return (ipToInt(ip) & mask) === (ipToInt(network) & mask);
  } catch {
    return false;
  }
}

async function getOrgAllowlist(orgId: string): Promise<string[]> {
  const cached = cache.get(orgId);
  if (cached && cached.exp > Date.now()) return cached.cidrs;

  try {
    const rows = await supabaseRestAsService('organizations', new URLSearchParams({
      select: 'ip_allowlist',
      id: `eq.${orgId}`,
      limit: '1',
    }));
    const row = Array.isArray(rows) ? rows[0] : null;
    const cidrs: string[] = Array.isArray(row?.ip_allowlist) ? row.ip_allowlist : [];
    cache.set(orgId, { cidrs, exp: Date.now() + CACHE_TTL_MS });
    return cidrs;
  } catch (err: any) {
    logger.warn('ipAllowlist: failed to fetch org allowlist', { orgId, err: err?.message });
    return [];
  }
}

export async function enforceIpAllowlist(req: Request, res: Response, next: NextFunction): Promise<void> {
  const orgId = req.user?.organization_id;
  if (!orgId) return next();

  const cidrs = await getOrgAllowlist(orgId);
  if (cidrs.length === 0) return next(); // no restrictions configured

  const clientIp = (req.ip || '').replace(/^::ffff:/, ''); // strip IPv4-mapped IPv6
  const allowed = cidrs.some((cidr) => ipMatchesCidr(clientIp, cidr));

  if (!allowed) {
    logger.warn('ipAllowlist: blocked request from non-allowlisted IP', { orgId, clientIp });
    res.status(403).json({
      success: false,
      error: 'Access denied: your IP address is not on the allowlist for this organisation.',
      code: 'ip_not_allowlisted',
    });
    return;
  }

  next();
}

export function clearIpAllowlistCache(orgId: string): void {
  cache.delete(orgId);
}
