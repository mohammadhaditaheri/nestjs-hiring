import { IsPhoneNumber, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendOtpDto {
    @ApiProperty({
        description: 'Iranian mobile phone number',
        example: '09123456789',
        pattern: '^09\\d{9}$',
    })
    @IsNotEmpty({ message: 'Phone number is required' })
    @Matches(/^09\d{9}$/, {
        message: 'Phone number must be a valid Iranian mobile number (09xxxxxxxxx)',
    })
    phone: string;
}

export class VerifyOtpDto {
    @ApiProperty({
        description: 'Iranian mobile phone number',
        example: '09123456789',
        pattern: '^09\\d{9}$',
    })
    @IsNotEmpty({ message: 'Phone number is required' })
    @Matches(/^09\d{9}$/, {
        message: 'Phone number must be a valid Iranian mobile number (09xxxxxxxxx)',
    })
    phone: string;

    @ApiProperty({
        description: '6-digit OTP code',
        example: '123456',
        minLength: 6,
        maxLength: 6,
    })
    @IsNotEmpty({ message: 'OTP code is required' })
    @Matches(/^\d{6}$/, {
        message: 'OTP code must be exactly 6 digits',
    })
    code: string;
}