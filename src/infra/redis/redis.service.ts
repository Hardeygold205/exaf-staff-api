import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { CacheKeys } from "../../common/cache-keys";

type MemoryEntry = { value: string; expiresAt: number };

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private readonly memory = new Map<string, MemoryEntry>();

  constructor(private config: ConfigService) {
    const url = this.config.get<string>("REDIS_URL");
    if (!url) {
      this.logger.warn("REDIS_URL not set — using in-memory cache fallback");
      return;
    }

    this.client = new Redis(url, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
    });

    this.client.on("error", (err) => {
      this.logger.warn(
        `Redis error: ${err.message} — falling back to memory for this process`,
      );
    });

    this.client.connect().catch((err: Error) => {
      this.logger.warn(
        `Redis connect failed (${err.message}) — using in-memory cache`,
      );
      this.client?.disconnect();
      this.client = null;
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.client) {
        const raw = await this.client.get(key);
        return raw ? (JSON.parse(raw) as T) : null;
      }
    } catch (err) {
      this.logger.warn(`Redis GET ${key} failed: ${(err as Error).message}`);
    }

    const entry = this.memory.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.memory.delete(key);
      return null;
    }
    return JSON.parse(entry.value) as T;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const payload = JSON.stringify(value);
    try {
      if (this.client) {
        await this.client.set(key, payload, "EX", ttlSeconds);
        return;
      }
    } catch (err) {
      this.logger.warn(`Redis SET ${key} failed: ${(err as Error).message}`);
    }

    this.memory.set(key, {
      value: payload,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string): Promise<void> {
    this.memory.delete(key);
    try {
      if (this.client) await this.client.del(key);
    } catch (err) {
      this.logger.warn(`Redis DEL ${key} failed: ${(err as Error).message}`);
    }
  }

  async blacklistAccessToken(jti: string, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;
    await this.set(CacheKeys.blacklistedAccessToken(jti), true, ttlSeconds);
  }

  async isAccessTokenBlacklisted(jti: string): Promise<boolean> {
    return (
      (await this.get<boolean>(CacheKeys.blacklistedAccessToken(jti))) === true
    );
  }

  async onModuleDestroy() {
    if (this.client) await this.client.quit();
  }
}
