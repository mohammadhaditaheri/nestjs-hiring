import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { RedisService } from '../../shared/redis/redis.service';
import { SmsService } from '../../shared/sms/sms.service';
import { User } from './entities/user.entity';
import { UserSession } from './entities/user-session.entity';

describe('AuthService', () => {
    let service: AuthService;
    let userRepository: Repository<User>;
    let sessionRepository: Repository<UserSession>;
    let redisService: RedisService;
    let smsService: SmsService;
    let configService: ConfigService;

    const mockUser = {
        id: 'user-id',
        phone: '09123456789',
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockSession = {
        id: 'session-id',
        userId: 'user-id',
        tokenHash: 'hashed-token',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockUserRepository = {
        findOne: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        find: jest.fn(),
    };

    const mockSessionRepository = {
        create: jest.fn(),
        save: jest.fn(),
        find: jest.fn(),
        findOne: jest.fn(),
    };

    const mockRedisService = {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        exists: jest.fn(),
        incr: jest.fn(),
        expire: jest.fn(),
        ttl: jest.fn(),
    };

    const mockSmsService = {
        sendOtp: jest.fn(),
        generateOtpCode: jest.fn(),
        isValidPhoneNumber: jest.fn(),
    };

    const mockConfigService = {
        get: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: getRepositoryToken(User),
                    useValue: mockUserRepository,
                },
                {
                    provide: getRepositoryToken(UserSession),
                    useValue: mockSessionRepository,
                },
                {
                    provide: RedisService,
                    useValue: mockRedisService,
                },
                {
                    provide: SmsService,
                    useValue: mockSmsService,
                },
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
        userRepository = module.get<Repository<User>>(getRepositoryToken(User));
        sessionRepository = module.get<Repository<UserSession>>(getRepositoryToken(UserSession));
        redisService = module.get<RedisService>(RedisService);
        smsService = module.get<SmsService>(SmsService);
        configService = module.get<ConfigService>(ConfigService);

        // Setup default mock returns
        mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
            const config: Record<string, any> = {
                OTP_CODE_TTL: 120,
                OTP_SEND_LIMIT_TTL: 120,
                OTP_VERIFY_MAX_ATTEMPTS: 5,
                OTP_VERIFY_ATTEMPTS_TTL: 60,
                BCRYPT_SALT_ROUNDS: 12,
            };
            return config[key] || defaultValue;
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('sendOtp', () => {
        it('should send OTP successfully', async () => {
            const sendOtpDto = { phone: '09123456789' };
            const clientIp = '127.0.0.1';

            mockRedisService.exists.mockResolvedValue(false);
            mockSmsService.generateOtpCode.mockReturnValue('123456');
            mockSmsService.sendOtp.mockResolvedValue({ status: 200, message: 'Success' });
            mockRedisService.set.mockResolvedValue(true);

            const result = await service.sendOtp(sendOtpDto, clientIp);

            expect(result).toEqual({ message: 'OTP code sent successfully' });
            expect(mockRedisService.set).toHaveBeenCalledTimes(3); // OTP data + 2 rate limits
            expect(mockSmsService.sendOtp).toHaveBeenCalledWith('09123456789', '123456');
        });

        it('should throw rate limit error when phone is rate limited', async () => {
            const sendOtpDto = { phone: '09123456789' };
            const clientIp = '127.0.0.1';

            // Mock Redis exists to return true for rate limit keys
            mockRedisService.exists.mockImplementation((key: string) => {
                if (key.includes('otp:send:limit:')) {
                    return Promise.resolve(true); // Rate limit exists
                }
                return Promise.resolve(false);
            });

            await expect(service.sendOtp(sendOtpDto, clientIp)).rejects.toThrow(
                new HttpException(
                    'Rate limit exceeded. Please wait 2 minutes before requesting another OTP.',
                    HttpStatus.TOO_MANY_REQUESTS,
                ),
            );
        });

        it('should throw error when SMS service fails', async () => {
            const sendOtpDto = { phone: '09123456789' };
            const clientIp = '127.0.0.1';

            mockRedisService.exists.mockResolvedValue(false);
            mockSmsService.generateOtpCode.mockReturnValue('123456');
            mockSmsService.sendOtp.mockResolvedValue({ status: 500, message: 'SMS service error' });
            mockRedisService.set.mockResolvedValue(true);

            await expect(service.sendOtp(sendOtpDto, clientIp)).rejects.toThrow(
                new HttpException(
                    'Failed to send SMS. Please try again later.',
                    HttpStatus.SERVICE_UNAVAILABLE,
                ),
            );
        });
    });

    describe('verifyOtp', () => {
        it('should verify OTP and create session successfully', async () => {
            const verifyOtpDto = { phone: '09123456789', code: '123456' };
            const userAgent = 'Mozilla/5.0';
            const clientIp = '127.0.0.1';

            const otpData = {
                code: '123456',
                expiresAt: Date.now() + 120000,
                attempts: 0,
            };

            mockRedisService.get.mockImplementation((key: string) => {
                if (key.includes('otp:phone')) return Promise.resolve(otpData);
                return Promise.resolve(null);
            });
            mockRedisService.ttl.mockResolvedValue(60);
            mockRedisService.del.mockResolvedValue(true);
            mockUserRepository.findOne.mockResolvedValue(null);
            mockUserRepository.create.mockReturnValue(mockUser);
            mockUserRepository.save.mockResolvedValue(mockUser);
            mockSessionRepository.create.mockReturnValue(mockSession);
            mockSessionRepository.save.mockResolvedValue(mockSession);

            const result = await service.verifyOtp(verifyOtpDto, userAgent, clientIp);

            expect(result).toHaveProperty('token');
            expect(result).toHaveProperty('user');
            expect(result.user.phone).toBe('09123456789');
            expect(mockUserRepository.create).toHaveBeenCalled();
            expect(mockSessionRepository.create).toHaveBeenCalled();
        });

        it('should throw error when OTP is expired', async () => {
            const verifyOtpDto = { phone: '09123456789', code: '123456' };

            const expiredOtpData = {
                code: '123456',
                expiresAt: Date.now() - 1000, // Expired
                attempts: 0,
            };

            mockRedisService.get.mockResolvedValue(expiredOtpData);
            mockRedisService.del.mockResolvedValue(true);

            await expect(service.verifyOtp(verifyOtpDto)).rejects.toThrow(
                new HttpException(
                    'OTP code has expired. Please request a new code.',
                    HttpStatus.BAD_REQUEST,
                ),
            );
        });

        it('should throw error when OTP code is invalid', async () => {
            const verifyOtpDto = { phone: '09123456789', code: '123456' };

            const otpData = {
                code: '654321', // Wrong code
                expiresAt: Date.now() + 120000,
                attempts: 0,
            };

            mockRedisService.get.mockResolvedValue(otpData);
            mockRedisService.ttl.mockResolvedValue(60);
            mockRedisService.set.mockResolvedValue(true);
            mockRedisService.incr.mockResolvedValue(1);

            await expect(service.verifyOtp(verifyOtpDto)).rejects.toThrow(
                new HttpException(
                    'Invalid OTP code. Please check and try again.',
                    HttpStatus.BAD_REQUEST,
                ),
            );
        });

        it('should throw rate limit error when verification attempts exceeded', async () => {
            const verifyOtpDto = { phone: '09123456789', code: '123456' };

            mockRedisService.get.mockImplementation((key: string) => {
                if (key.includes('attempts')) return Promise.resolve(5); // Max attempts
                return Promise.resolve(null);
            });

            await expect(service.verifyOtp(verifyOtpDto)).rejects.toThrow(
                new HttpException(
                    'Too many verification attempts. Please wait and try again.',
                    HttpStatus.TOO_MANY_REQUESTS,
                ),
            );
        });
    });

    describe('getUserSessions', () => {
        it('should return user sessions', async () => {
            const userId = 'user-id';
            const sessions = [mockSession];

            mockSessionRepository.find.mockResolvedValue(sessions);

            const result = await service.getUserSessions(userId);

            expect(result).toHaveLength(1);
            expect(result[0]).toHaveProperty('id', 'session-id');
            expect(result[0]).toHaveProperty('isActive', true);
            expect(mockSessionRepository.find).toHaveBeenCalledWith({
                where: { userId, isActive: true },
                order: { createdAt: 'DESC' },
            });
        });
    });

    describe('deleteSession', () => {
        it('should delete session successfully', async () => {
            const userId = 'user-id';
            const sessionId = 'session-id';

            mockSessionRepository.findOne.mockResolvedValue(mockSession);
            mockSessionRepository.save.mockResolvedValue({ ...mockSession, isActive: false });

            const result = await service.deleteSession(userId, sessionId);

            expect(result).toEqual({ message: 'Session deleted successfully' });
            expect(mockSessionRepository.save).toHaveBeenCalledWith(
                expect.objectContaining({ isActive: false }),
            );
        });

        it('should throw error when session not found', async () => {
            const userId = 'user-id';
            const sessionId = 'session-id';

            mockSessionRepository.findOne.mockResolvedValue(null);

            await expect(service.deleteSession(userId, sessionId)).rejects.toThrow(
                new HttpException('Session not found', HttpStatus.NOT_FOUND),
            );
        });
    });

    describe('validateToken', () => {
        it('should validate token successfully', async () => {
            const token = 'valid-token';
            const sessions = [{ ...mockSession, user: mockUser }];

            mockSessionRepository.find.mockResolvedValue(sessions);

            // Mock bcrypt.compare to return true
            jest.doMock('bcrypt', () => ({
                compare: jest.fn().mockResolvedValue(true),
            }));

            const result = await service.validateToken(token);

            expect(mockSessionRepository.find).toHaveBeenCalledWith({
                where: { isActive: true },
                relations: ['user'],
            });
        });

        it('should return null for invalid token', async () => {
            const token = 'invalid-token';

            mockSessionRepository.find.mockResolvedValue([]);

            const result = await service.validateToken(token);

            expect(result).toBeNull();
        });
    });
});