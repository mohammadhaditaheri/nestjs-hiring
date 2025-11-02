import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
    private readonly logger = new Logger(RedisService.name);
    private readonly redis: Redis;

    constructor(private readonly configService: ConfigService) {
        this.redis = new Redis({
            host: this.configService.get<string>('REDIS_HOST', 'localhost'),
            port: this.configService.get<number>('REDIS_PORT', 6379),
            password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
            enableReadyCheck: false,
            maxRetriesPerRequest: null,
        }); this.redis.on('connect', () => {
            this.logger.log('Connected to Redis');
        });

        this.redis.on('error', (error) => {
            this.logger.error('Redis connection error:', error);
        });
    }

    async get<T = any>(key: string): Promise<T | null> {
        try {
            const value = await this.redis.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            this.logger.error(`Error getting key ${key}:`, error);
            return null;
        }
    }

    async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
        try {
            const serialized = JSON.stringify(value);
            if (ttlSeconds) {
                await this.redis.setex(key, ttlSeconds, serialized);
            } else {
                await this.redis.set(key, serialized);
            }
            return true;
        } catch (error) {
            this.logger.error(`Error setting key ${key}:`, error);
            return false;
        }
    }

    async del(key: string): Promise<boolean> {
        try {
            const result = await this.redis.del(key);
            return result > 0;
        } catch (error) {
            this.logger.error(`Error deleting key ${key}:`, error);
            return false;
        }
    }

    async exists(key: string): Promise<boolean> {
        try {
            const result = await this.redis.exists(key);
            return result === 1;
        } catch (error) {
            this.logger.error(`Error checking existence of key ${key}:`, error);
            return false;
        }
    }

    async incr(key: string): Promise<number> {
        try {
            return await this.redis.incr(key);
        } catch (error) {
            this.logger.error(`Error incrementing key ${key}:`, error);
            throw error;
        }
    }

    async expire(key: string, ttlSeconds: number): Promise<boolean> {
        try {
            const result = await this.redis.expire(key, ttlSeconds);
            return result === 1;
        } catch (error) {
            this.logger.error(`Error setting expiration for key ${key}:`, error);
            return false;
        }
    }

    async ttl(key: string): Promise<number> {
        try {
            return await this.redis.ttl(key);
        } catch (error) {
            this.logger.error(`Error getting TTL for key ${key}:`, error);
            return -1;
        }
    }

    getClient(): Redis {
        return this.redis;
    }
}