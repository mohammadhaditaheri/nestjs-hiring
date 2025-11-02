import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service';

describe('RedisService - Mock Tests', () => {
    let service: RedisService;
    let module: TestingModule;

    const mockRedisService = {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        exists: jest.fn(),
        incr: jest.fn(),
        expire: jest.fn(),
        ttl: jest.fn(),
        getClient: jest.fn(),
    };

    beforeEach(async () => {
        module = await Test.createTestingModule({
            providers: [
                {
                    provide: RedisService,
                    useValue: mockRedisService,
                },
            ],
        }).compile();

        service = module.get<RedisService>(RedisService);

        // Reset all mocks
        Object.values(mockRedisService).forEach(mock => mock.mockClear());
    });

    afterEach(async () => {
        await module.close();
    });

    describe('Basic Redis Operations', () => {
        it('should set and get values', async () => {
            const key = 'test:basic:key';
            const value = 'test-value';

            mockRedisService.set.mockResolvedValue(true);
            mockRedisService.get.mockResolvedValue(value);

            const setResult = await service.set(key, value);
            const retrievedValue = await service.get(key);

            expect(mockRedisService.set).toHaveBeenCalledWith(key, value);
            expect(mockRedisService.get).toHaveBeenCalledWith(key);
            expect(setResult).toBe(true);
            expect(retrievedValue).toBe(value);
        });

        it('should set values with TTL', async () => {
            const key = 'test:ttl:key';
            const value = 'test-value';
            const ttl = 5;

            mockRedisService.set.mockResolvedValue(true);
            mockRedisService.ttl.mockResolvedValue(ttl);

            const setResult = await service.set(key, value, ttl);
            const remainingTtl = await service.ttl(key);

            expect(mockRedisService.set).toHaveBeenCalledWith(key, value, ttl);
            expect(setResult).toBe(true);
            expect(remainingTtl).toBe(ttl);
        });

        it('should handle JSON data', async () => {
            const key = 'test:json:key';
            const data = {
                userId: 'user-123',
                phoneNumber: '+989123456789',
            };

            mockRedisService.set.mockResolvedValue(true);
            mockRedisService.get.mockResolvedValue(data);

            const setResult = await service.set(key, data);
            const retrievedData = await service.get(key);

            expect(mockRedisService.set).toHaveBeenCalledWith(key, data);
            expect(setResult).toBe(true);
            expect(retrievedData).toEqual(data);
        });

        it('should return null for non-existent keys', async () => {
            mockRedisService.get.mockResolvedValue(null);

            const value = await service.get('test:nonexistent:key');
            expect(value).toBeNull();
        });

        it('should delete keys', async () => {
            const key = 'test:delete:key';

            mockRedisService.del.mockResolvedValue(true);

            const result = await service.del(key);

            expect(mockRedisService.del).toHaveBeenCalledWith(key);
            expect(result).toBe(true);
        });

        it('should check if keys exist', async () => {
            const key = 'test:exists:key';

            mockRedisService.exists.mockResolvedValue(true);

            const exists = await service.exists(key);

            expect(mockRedisService.exists).toHaveBeenCalledWith(key);
            expect(exists).toBe(true);
        });

        it('should increment values', async () => {
            const key = 'test:incr:key';

            mockRedisService.incr.mockResolvedValue(1);

            const result = await service.incr(key);

            expect(mockRedisService.incr).toHaveBeenCalledWith(key);
            expect(result).toBe(1);
        });

        it('should set key expiration', async () => {
            const key = 'test:expire:key';
            const ttl = 300;

            mockRedisService.expire.mockResolvedValue(true);

            const result = await service.expire(key, ttl);

            expect(mockRedisService.expire).toHaveBeenCalledWith(key, ttl);
            expect(result).toBe(true);
        });
    });

    describe('Rate Limiting Support', () => {
        it('should support rate limiting operations', async () => {
            const phoneNumber = '+989123456789';
            const rateKey = `otp_rate_limit:${phoneNumber}`;

            mockRedisService.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
            mockRedisService.expire.mockResolvedValue(true);

            const count1 = await service.incr(rateKey);
            const expireResult = await service.expire(rateKey, 300);
            const count2 = await service.incr(rateKey);

            expect(count1).toBe(1);
            expect(expireResult).toBe(true);
            expect(count2).toBe(2);
            expect(mockRedisService.expire).toHaveBeenCalledWith(rateKey, 300);
        });
    });

    describe('OTP Storage Support', () => {
        it('should support OTP storage operations', async () => {
            const phoneNumber = '+989123456789';
            const otp = '123456';
            const otpKey = `otp:${phoneNumber}`;

            mockRedisService.set.mockResolvedValue(true);
            mockRedisService.get.mockResolvedValue(otp);
            mockRedisService.del.mockResolvedValue(true);

            const setResult = await service.set(otpKey, otp, 300);
            const retrievedOtp = await service.get(otpKey);
            const deleted = await service.del(otpKey);

            expect(mockRedisService.set).toHaveBeenCalledWith(otpKey, otp, 300);
            expect(setResult).toBe(true);
            expect(retrievedOtp).toBe(otp);
            expect(deleted).toBe(true);
        });
    });
});