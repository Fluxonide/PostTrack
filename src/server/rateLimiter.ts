export interface CarrierLimitConfig {
  maxPerMinute: number;
  minIntervalMs: number; // minimum time between consecutive requests to the same carrier
  defaultCooldownMs: number;
}

export interface CarrierLimitStats {
  carrier: string;
  maxPerMinute: number;
  requestsThisMinute: number;
  remainingThisMinute: number;
  isCoolingDown: boolean;
  cooldownUntil: string | null;
  lastRequestAt: string | null;
  totalRequests: number;
}

const DEFAULT_CONFIG: CarrierLimitConfig = {
  maxPerMinute: 15,
  minIntervalMs: 2500, // 2.5s between requests to prevent scraper flags
  defaultCooldownMs: 5 * 60 * 1000, // 5 min backoff on 429
};

const CARRIER_CONFIGS: Record<string, Partial<CarrierLimitConfig>> = {
  amazon: { maxPerMinute: 10, minIntervalMs: 3000 },
  ekart: { maxPerMinute: 12, minIntervalMs: 2500 },
  xpressbees: { maxPerMinute: 10, minIntervalMs: 3000 },
  bluedart: { maxPerMinute: 20, minIntervalMs: 2000 },
  delhivery: { maxPerMinute: 30, minIntervalMs: 1500 },
  stcourier: { maxPerMinute: 15, minIntervalMs: 2500 },
  tpc: { maxPerMinute: 15, minIntervalMs: 2500 },
  shiprocket: { maxPerMinute: 20, minIntervalMs: 2000 },
  valmo: { maxPerMinute: 15, minIntervalMs: 2500 },
};

interface CarrierState {
  requestTimestamps: number[];
  lastRequestTime: number;
  cooldownUntil: number;
  totalRequests: number;
}

class CarrierRateLimiter {
  private states = new Map<string, CarrierState>();

  private getState(carrierId: string): CarrierState {
    const id = carrierId.toLowerCase();
    let state = this.states.get(id);
    if (!state) {
      state = {
        requestTimestamps: [],
        lastRequestTime: 0,
        cooldownUntil: 0,
        totalRequests: 0,
      };
      this.states.set(id, state);
    }
    return state;
  }

  public getConfig(carrierId: string): CarrierLimitConfig {
    const override = CARRIER_CONFIGS[carrierId.toLowerCase()] || {};
    return { ...DEFAULT_CONFIG, ...override };
  }

  public canRequest(carrierId: string): boolean {
    const id = carrierId.toLowerCase();
    const state = this.getState(id);
    const config = this.getConfig(id);
    const now = Date.now();

    if (state.cooldownUntil > now) {
      return false;
    }

    // Purge timestamps older than 60 seconds
    state.requestTimestamps = state.requestTimestamps.filter((t) => now - t < 60000);

    if (state.requestTimestamps.length >= config.maxPerMinute) {
      return false;
    }

    if (now - state.lastRequestTime < config.minIntervalMs) {
      return false;
    }

    return true;
  }

  public recordRequest(carrierId: string): void {
    const id = carrierId.toLowerCase();
    const state = this.getState(id);
    const now = Date.now();

    state.requestTimestamps.push(now);
    state.lastRequestTime = now;
    state.totalRequests += 1;
  }

  public recordRateLimitHit(carrierId: string, customCooldownMs?: number): void {
    const id = carrierId.toLowerCase();
    const state = this.getState(id);
    const config = this.getConfig(id);
    const cooldown = customCooldownMs ?? config.defaultCooldownMs;
    state.cooldownUntil = Date.now() + cooldown;
    console.warn(`[RateLimiter] Carrier "${id}" rate-limited. Backing off for ${Math.round(cooldown / 1000)}s.`);
  }

  public async waitForSlot(carrierId: string, maxWaitMs = 15000): Promise<boolean> {
    const id = carrierId.toLowerCase();
    const start = Date.now();

    while (Date.now() - start < maxWaitMs) {
      if (this.canRequest(id)) {
        this.recordRequest(id);
        return true;
      }

      const state = this.getState(id);
      const config = this.getConfig(id);
      const now = Date.now();

      if (state.cooldownUntil > now) {
        return false; // In backoff, don't block
      }

      // Calculate how long to wait
      let waitMs = config.minIntervalMs - (now - state.lastRequestTime);
      if (state.requestTimestamps.length >= config.maxPerMinute && state.requestTimestamps.length > 0) {
        const oldest = state.requestTimestamps[0];
        const minuteWait = 60000 - (now - oldest);
        waitMs = Math.max(waitMs, minuteWait);
      }

      waitMs = Math.min(Math.max(waitMs, 300), 2000);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    return false;
  }

  public getStats(): CarrierLimitStats[] {
    const now = Date.now();
    const allCarriers = Object.keys(CARRIER_CONFIGS);

    return allCarriers.map((carrier) => {
      const state = this.getState(carrier);
      const config = this.getConfig(carrier);

      const recent = state.requestTimestamps.filter((t) => now - t < 60000);
      const isCooling = state.cooldownUntil > now;

      return {
        carrier,
        maxPerMinute: config.maxPerMinute,
        requestsThisMinute: recent.length,
        remainingThisMinute: Math.max(0, config.maxPerMinute - recent.length),
        isCoolingDown: isCooling,
        cooldownUntil: isCooling ? new Date(state.cooldownUntil).toISOString() : null,
        lastRequestAt: state.lastRequestTime > 0 ? new Date(state.lastRequestTime).toISOString() : null,
        totalRequests: state.totalRequests,
      };
    });
  }
}

export const carrierRateLimiter = new CarrierRateLimiter();
