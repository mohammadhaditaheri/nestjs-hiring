import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
    @Get()
    @ApiOperation({
        summary: 'Health check endpoint',
        description: 'Check if the application is running and healthy.',
    })
    @ApiResponse({
        status: 200,
        description: 'Application is healthy',
        schema: {
            type: 'object',
            properties: {
                status: { type: 'string', example: 'ok' },
                timestamp: { type: 'string', example: '2023-10-31T10:00:00.000Z' },
                uptime: { type: 'number', example: 12345 },
                version: { type: 'string', example: '1.0.0' },
            },
        },
    })
    checkHealth() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: process.env.npm_package_version || '1.0.0',
        };
    }
}