export const AppConfig = () => ({
    app: {
        name: process.env.APP_NAME || 'NestJS Hiring Test',
        version: process.env.APP_VERSION || '1.0.0',
        port: parseInt(process.env.PORT || '3000', 10),
        environment: process.env.NODE_ENV || 'development',
    },
    security: {
        jwtSecret: process.env.JWT_SECRET || 'super-secret-jwt-key',
        bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
    },
    rateLimit: {
        otpSendLimitTtl: parseInt(process.env.OTP_SEND_LIMIT_TTL || '120', 10),
        otpVerifyAttemptsTtl: parseInt(process.env.OTP_VERIFY_ATTEMPTS_TTL || '60', 10),
        otpVerifyMaxAttempts: parseInt(process.env.OTP_VERIFY_MAX_ATTEMPTS || '5', 10),
        otpCodeTtl: parseInt(process.env.OTP_CODE_TTL || '120', 10),
    },
    sms: {
        apiKey: process.env.SMS_IR_API_KEY || '',
        templateId: process.env.SMS_IR_TEMPLATE_ID || '805161',
        baseUrl: process.env.SMS_IR_BASE_URL || 'https://api.sms.ir',
    },
    prediction: {
        iranTeamId: process.env.IRAN_TEAM_ID || 'bf5556ec-a78d-4047-a0f5-7b34b07c21aa',
        correctGroupsCacheKey: process.env.CORRECT_GROUPS_CACHE_KEY || 'correct_groups',
        correctGroupsCacheTtl: parseInt(process.env.CORRECT_GROUPS_CACHE_TTL || '3600', 10),
    },
});