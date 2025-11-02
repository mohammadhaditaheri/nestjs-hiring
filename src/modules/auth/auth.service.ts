import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from '../../shared/redis/redis.service';
import { SmsService } from '../../shared/sms/sms.service';
import { User } from './entities/user.entity';
import { UserSession } from './entities/user-session.entity';
import { SendOtpDto, VerifyOtpDto } from './dto/auth.dto';
import { OtpData } from './interfaces/otp.interface';
import { AuthResponse } from './interfaces/auth.interface';
import { SessionData } from './interfaces/session.interface';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(UserSession)
        private readonly sessionRepository: Repository<UserSession>,
        private readonly redisService: RedisService,
        private readonly smsService: SmsService,
        private readonly configService: ConfigService,
    ) { }

    /**
     * Send OTP code to phone number
     * Implements rate limiting: 1 request per 2 minutes per phone and IP
     */
    async sendOtp(sendOtpDto: SendOtpDto, clientIp: string): Promise<{ message: string }> {
        const { phone } = sendOtpDto;
        const startTime = Date.now();

        try {
            // Check rate limits
            await this.checkSendRateLimit(phone, clientIp);

            // Generate OTP code
            const otpCode = this.smsService.generateOtpCode();
            const expiresAt = Date.now() + (this.configService.get<number>('OTP_CODE_TTL', 120) * 1000);

            // Store OTP in Redis
            const otpData: OtpData = {
                code: otpCode,
                expiresAt,
                attempts: 0,
            };

            const otpKey = `otp:phone:${phone}`;
            const ttl = this.configService.get<number>('OTP_CODE_TTL', 120);

            await this.redisService.set(otpKey, otpData, ttl);

            // Set rate limit flags
            await this.setSendRateLimit(phone, clientIp);

            // Send SMS
            const smsResult = await this.smsService.sendOtp(phone, otpCode);

            if (smsResult.status !== 200 && smsResult.status !== 201) {
                throw new HttpException(
                    'Failed to send SMS. Please try again later.',
                    HttpStatus.SERVICE_UNAVAILABLE,
                );
            }

            const responseTime = Date.now() - startTime;
            this.logger.log(`OTP sent to ${phone} in ${responseTime}ms`);

            // Ensure response time < 300ms requirement
            if (responseTime > 300) {
                this.logger.warn(`OTP send response time exceeded 300ms: ${responseTime}ms`);
            }

            return { message: 'OTP code sent successfully' };

        } catch (error) {
            const responseTime = Date.now() - startTime;
            this.logger.error(`OTP send failed for ${phone} in ${responseTime}ms:`, error);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                'Failed to send OTP code',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Verify OTP code and create session
     * Implements rate limiting: max 5 attempts per minute
     */
    async verifyOtp(
        verifyOtpDto: VerifyOtpDto,
        userAgent?: string,
        clientIp?: string,
    ): Promise<AuthResponse> {
        const { phone, code } = verifyOtpDto;
        const startTime = Date.now();

        try {
            // Check verification rate limit
            await this.checkVerifyRateLimit(phone);

            // Get OTP from Redis
            const otpKey = `otp:phone:${phone}`;
            const otpData = await this.redisService.get<OtpData>(otpKey);

            if (!otpData) {
                throw new HttpException(
                    'OTP code expired or not found. Please request a new code.',
                    HttpStatus.BAD_REQUEST,
                );
            }

            // Check expiration
            if (Date.now() > otpData.expiresAt) {
                await this.redisService.del(otpKey);
                throw new HttpException(
                    'OTP code has expired. Please request a new code.',
                    HttpStatus.BAD_REQUEST,
                );
            }

            // Verify code
            if (otpData.code !== code) {
                // Increment attempts
                otpData.attempts += 1;
                await this.redisService.set(otpKey, otpData, await this.redisService.ttl(otpKey));

                await this.incrementVerifyAttempts(phone);

                throw new HttpException(
                    'Invalid OTP code. Please check and try again.',
                    HttpStatus.BAD_REQUEST,
                );
            }

            // Clean up OTP from Redis
            await this.redisService.del(otpKey);

            // Find or create user
            let user = await this.userRepository.findOne({ where: { phone } });

            if (!user) {
                user = this.userRepository.create({
                    phone,
                    isVerified: true,
                });
                user = await this.userRepository.save(user);
            } else if (!user.isVerified) {
                user.isVerified = true;
                user = await this.userRepository.save(user);
            }

            // Create session token
            const token = uuidv4();
            const saltRounds = this.configService.get<number>('security.bcryptSaltRounds', 12);
            const tokenHash = await bcrypt.hash(token, saltRounds);
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

            // Save session
            const session = this.sessionRepository.create({
                userId: user.id,
                tokenHash,
                expiresAt,
                userAgent,
                ipAddress: clientIp,
                isActive: true,
            });

            await this.sessionRepository.save(session);

            const responseTime = Date.now() - startTime;
            this.logger.log(`OTP verified for ${phone} in ${responseTime}ms`);

            // Ensure response time < 300ms requirement
            if (responseTime > 300) {
                this.logger.warn(`OTP verify response time exceeded 300ms: ${responseTime}ms`);
            }

            return {
                token,
                user: {
                    id: user.id,
                    phone: user.phone,
                    isVerified: user.isVerified,
                },
            };

        } catch (error) {
            const responseTime = Date.now() - startTime;
            this.logger.error(`OTP verification failed for ${phone} in ${responseTime}ms:`, error);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                'Failed to verify OTP code',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Get user's active sessions
     */
    async getUserSessions(userId: string): Promise<SessionData[]> {
        const sessions = await this.sessionRepository.find({
            where: { userId, isActive: true },
            order: { createdAt: 'DESC' },
        });

        return sessions.map(session => ({
            id: session.id,
            createdAt: session.createdAt.toISOString(),
            expiresAt: session.expiresAt.toISOString(),
            userAgent: session.userAgent,
            ipAddress: session.ipAddress,
            isActive: session.isActive,
        }));
    }

    /**
     * Delete a specific session (logout)
     */
    async deleteSession(userId: string, sessionId: string): Promise<{ message: string }> {
        const session = await this.sessionRepository.findOne({
            where: { id: sessionId, userId, isActive: true },
        });

        if (!session) {
            throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
        }

        session.isActive = false;
        await this.sessionRepository.save(session);

        return { message: 'Session deleted successfully' };
    }

    /**
     * Validate session token
     */
    async validateToken(token: string): Promise<User | null> {
        const sessions = await this.sessionRepository.find({
            where: { isActive: true },
            relations: ['user'],
        });

        for (const session of sessions) {
            if (await bcrypt.compare(token, session.tokenHash)) {
                if (session.expiresAt < new Date()) {
                    session.isActive = false;
                    await this.sessionRepository.save(session);
                    return null;
                }
                return session.user;
            }
        }

        return null;
    }

    private async checkSendRateLimit(phone: string, clientIp: string): Promise<void> {
        const phoneKey = `otp:send:limit:${phone}`;
        const ipKey = `otp:send:limit:ip:${clientIp}`;

        const [phoneLimit, ipLimit] = await Promise.all([
            this.redisService.exists(phoneKey),
            this.redisService.exists(ipKey),
        ]);

        if (phoneLimit || ipLimit) {
            throw new HttpException(
                'Rate limit exceeded. Please wait 2 minutes before requesting another OTP.',
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }
    }

    private async setSendRateLimit(phone: string, clientIp: string): Promise<void> {
        const phoneKey = `otp:send:limit:${phone}`;
        const ipKey = `otp:send:limit:ip:${clientIp}`;
        const ttl = this.configService.get<number>('OTP_SEND_LIMIT_TTL', 120);

        await Promise.all([
            this.redisService.set(phoneKey, '1', ttl),
            this.redisService.set(ipKey, '1', ttl),
        ]);
    }

    private async checkVerifyRateLimit(phone: string): Promise<void> {
        const key = `otp:verify:attempts:${phone}`;
        const attempts = await this.redisService.get<number>(key) || 0;
        const maxAttempts = this.configService.get<number>('OTP_VERIFY_MAX_ATTEMPTS', 5);

        if (attempts >= maxAttempts) {
            throw new HttpException(
                'Too many verification attempts. Please wait and try again.',
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }
    }

    private async incrementVerifyAttempts(phone: string): Promise<void> {
        const key = `otp:verify:attempts:${phone}`;
        const ttl = this.configService.get<number>('OTP_VERIFY_ATTEMPTS_TTL', 60);

        const attempts = await this.redisService.incr(key);
        if (attempts === 1) {
            await this.redisService.expire(key, ttl);
        }
    }
}