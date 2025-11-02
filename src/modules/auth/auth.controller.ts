import {
    Controller,
    Post,
    Get,
    Delete,
    Body,
    Param,
    Req,
    UseGuards,
    HttpCode,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { SendOtpDto, VerifyOtpDto } from './dto/auth.dto';

@ApiTags('Authentication')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
    private readonly logger = new Logger(AuthController.name);

    constructor(private readonly authService: AuthService) { }

    @Post('send-otp')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Send OTP code to phone number',
        description: 'Send a 6-digit OTP code via SMS. Rate limited to 1 request per 2 minutes per phone/IP.',
    })
    @ApiResponse({
        status: 200,
        description: 'OTP sent successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'OTP code sent successfully' },
            },
        },
    })
    @ApiResponse({
        status: 429,
        description: 'Rate limit exceeded',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 429 },
                message: { type: 'string', example: 'Rate limit exceeded. Please wait 2 minutes before requesting another OTP.' },
            },
        },
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid phone number format',
    })
    async sendOtp(@Body() sendOtpDto: SendOtpDto, @Req() request: Request) {
        const clientIp = this.getClientIp(request);
        this.logger.log(`OTP send request for ${sendOtpDto.phone} from IP: ${clientIp}`);

        return await this.authService.sendOtp(sendOtpDto, clientIp);
    }

    @Post('verify-otp')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Verify OTP code',
        description: 'Verify the OTP code and receive authentication token. Rate limited to 5 attempts per minute.',
    })
    @ApiResponse({
        status: 200,
        description: 'OTP verified successfully',
        schema: {
            type: 'object',
            properties: {
                token: { type: 'string', example: 'uuid-token-here' },
                user: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', example: 'user-uuid' },
                        phone: { type: 'string', example: '09123456789' },
                        isVerified: { type: 'boolean', example: true },
                    },
                },
            },
        },
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid or expired OTP code',
    })
    @ApiResponse({
        status: 429,
        description: 'Too many verification attempts',
    })
    async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto, @Req() request: Request) {
        const userAgent = request.get('User-Agent');
        const clientIp = this.getClientIp(request);

        this.logger.log(`OTP verification request for ${verifyOtpDto.phone} from IP: ${clientIp}`);

        return await this.authService.verifyOtp(verifyOtpDto, userAgent, clientIp);
    }

    @Get('sessions')
    @UseGuards(AuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Get user active sessions',
        description: 'Retrieve all active sessions for the authenticated user.',
    })
    @ApiResponse({
        status: 200,
        description: 'Active sessions retrieved successfully',
        schema: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string', example: 'session-uuid' },
                    createdAt: { type: 'string', example: '2023-10-31T10:00:00.000Z' },
                    expiresAt: { type: 'string', example: '2023-11-30T10:00:00.000Z' },
                    userAgent: { type: 'string', example: 'Mozilla/5.0...' },
                    ipAddress: { type: 'string', example: '192.168.1.1' },
                    isActive: { type: 'boolean', example: true },
                },
            },
        },
    })
    @ApiResponse({
        status: 401,
        description: 'Unauthorized - Invalid or missing token',
    })
    async getSessions(@Req() request: any) {
        const userId = request.user.id;
        this.logger.log(`Sessions request for user: ${userId}`);

        return await this.authService.getUserSessions(userId);
    }

    @Delete('sessions/:sessionId')
    @UseGuards(AuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Delete a session',
        description: 'Delete (logout from) a specific session.',
    })
    @ApiParam({
        name: 'sessionId',
        description: 'Session ID to delete',
        type: 'string',
    })
    @ApiResponse({
        status: 200,
        description: 'Session deleted successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Session deleted successfully' },
            },
        },
    })
    @ApiResponse({
        status: 401,
        description: 'Unauthorized - Invalid or missing token',
    })
    @ApiResponse({
        status: 404,
        description: 'Session not found',
    })
    async deleteSession(@Param('sessionId') sessionId: string, @Req() request: any) {
        const userId = request.user.id;
        this.logger.log(`Delete session request: ${sessionId} for user: ${userId}`);

        return await this.authService.deleteSession(userId, sessionId);
    }

    private getClientIp(request: Request): string {
        return (
            (request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
            (request.headers['x-real-ip'] as string) ||
            request.connection?.remoteAddress ||
            request.socket?.remoteAddress ||
            'unknown'
        );
    }
}