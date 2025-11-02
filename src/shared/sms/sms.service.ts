import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import { SmsResponse } from './interfaces/sms.interface';

@Injectable()
export class SmsService {
    private readonly logger = new Logger(SmsService.name);
    private readonly apiKey: string;
    private readonly templateId: string;
    private readonly baseUrl: string;

    constructor(
        private readonly configService: ConfigService,
        private readonly httpService: HttpService
    ) {
        this.apiKey = this.configService.get<string>('SMS_IR_API_KEY', '');
        this.templateId = this.configService.get<string>('SMS_IR_TEMPLATE_ID', '805161');
        this.baseUrl = this.configService.get<string>('SMS_IR_BASE_URL', 'https://api.sms.ir');

        // Configure HttpService defaults
        this.httpService.axiosRef.defaults.baseURL = this.baseUrl;
        this.httpService.axiosRef.defaults.timeout = 10000;
        this.httpService.axiosRef.defaults.headers['Content-Type'] = 'application/json';
        this.httpService.axiosRef.defaults.headers['x-api-key'] = this.apiKey;
    }

    /**
     * Send OTP code via SMS using SMS.ir service
     * @param phone - Mobile phone number (e.g., "09123456789")
     * @param code - OTP code to send
     * @returns Promise<SmsResponse>
     */
    async sendOtp(phone: string, code: string): Promise<SmsResponse> {
        try {
            this.logger.log(`Sending OTP to ${phone}`);

            // SMS.ir API payload for sending OTP
            const payload = {
                mobile: phone,
                templateId: parseInt(this.templateId),
                parameters: [
                    {
                        name: 'Code',
                        value: code,
                    },
                ],
            };

            const response: AxiosResponse = await firstValueFrom(
                this.httpService.post('/v1/send/verify', payload)
            );
            this.logger.log(`SMS sent successfully to ${phone}, MessageId: ${response.data?.data?.messageId} and OTP: ${code}`);

            return {
                status: response.status,
                message: 'OTP sent successfully',
                data: response.data,
            };
        } catch (error: any) {
            this.logger.error(`Failed to send SMS to ${phone}:`, error.response?.data || error.message);

            return {
                status: error.response?.status || 500,
                message: error.response?.data?.message || 'Failed to send SMS',
                data: error.response?.data,
            };
        }
    }

    /**
     * Validate phone number format
     * @param phone - Phone number to validate
     * @returns boolean
     */
    isValidPhoneNumber(phone: string): boolean {
        // Iranian mobile number validation: starts with 09 and has 11 digits
        const iranianMobileRegex = /^09\d{9}$/;
        return iranianMobileRegex.test(phone);
    }

    /**
     * Generate a 6-digit OTP code
     * @returns string
     */
    generateOtpCode(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    /**
     * Check SMS.ir service status
     * @returns Promise<SmsResponse>
     */
    async checkServiceStatus(): Promise<SmsResponse> {
        try {
            const response: AxiosResponse = await firstValueFrom(
                this.httpService.get('/v1/send/credit')
            );

            return {
                status: response.status,
                message: 'Service is available',
                data: response.data,
            };
        } catch (error: any) {
            this.logger.error('SMS service status check failed:', error.response?.data || error.message);

            return {
                status: error.response?.status || 500,
                message: 'Service unavailable',
                data: error.response?.data,
            };
        }
    }
}