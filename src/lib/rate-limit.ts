import { RateLimiterMemory } from "rate-limiter-flexible";

const loginRateLimiter = new RateLimiterMemory({
  points: 5,       // 5 attempts
  duration: 60,    // per 60 seconds
  blockDuration: 60,
});

export async function checkLoginRateLimit(ip: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  try {
    await loginRateLimiter.consume(ip);
    return { allowed: true };
  } catch (res) {
    const retryAfter = Math.ceil((res as { msBeforeNext: number }).msBeforeNext / 1000);
    return { allowed: false, retryAfter };
  }
}
