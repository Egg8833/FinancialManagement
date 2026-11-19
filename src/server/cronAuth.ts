import { createHash, timingSafeEqual } from 'crypto';

/** 以固定時間比較 `Authorization: Bearer <secret>`,避免以回應時間逐字元猜出 secret。 */
export function isAuthorizedCron(authHeader: string | null, secret: string | undefined): boolean {
  if (!secret || !authHeader) return false;
  // 先各自雜湊成固定長度,timingSafeEqual 才不會因長度不同而提早結束
  const a = createHash('sha256').update(authHeader).digest();
  const b = createHash('sha256').update(`Bearer ${secret}`).digest();
  return timingSafeEqual(a, b);
}
