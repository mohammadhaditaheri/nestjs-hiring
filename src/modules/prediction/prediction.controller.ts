import {
    Controller,
    Post,
    Get,
    Param,
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
import { PredictionService } from './prediction.service';
import { AuthGuard } from '../auth/guards/auth.guard';

@ApiTags('Predictions')
@Controller()
export class PredictionController {
    private readonly logger = new Logger(PredictionController.name);

    constructor(private readonly predictionService: PredictionService) { }

    @Post('admin/trigger-prediction-process')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Trigger prediction processing',
        description: 'Start processing all predictions with 6 scoring modes using RabbitMQ queue system.',
    })
    @ApiResponse({
        status: 200,
        description: 'Prediction processing started successfully',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Prediction processing started' },
                queuedCount: { type: 'number', example: 50000 },
            },
        },
    })
    @ApiResponse({
        status: 500,
        description: 'Internal server error',
    })
    async triggerPredictionProcess() {
        this.logger.log('Admin triggered prediction processing');
        return await this.predictionService.triggerPredictionProcessing();
    }

    @Get('prediction/result/:userId')
    @UseGuards(AuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Get user prediction result',
        description: 'Retrieve the prediction processing result for a specific user.',
    })
    @ApiParam({
        name: 'userId',
        description: 'User ID to get prediction result for',
        type: 'string',
    })
    @ApiResponse({
        status: 200,
        description: 'Prediction result retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                id: { type: 'string', example: 'result-uuid' },
                predictionId: { type: 'string', example: 'prediction-uuid' },
                userId: { type: 'string', example: 'user-uuid' },
                totalScore: { type: 'number', example: 100 },
                details: {
                    type: 'object',
                    properties: {
                        scoringResults: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    mode: { type: 'string', example: 'Mode 1' },
                                    score: { type: 'number', example: 100 },
                                    description: { type: 'string', example: 'All 48 teams in correct groups' },
                                    details: { type: 'object' },
                                },
                            },
                        },
                        processedAt: { type: 'string', example: '2023-10-31T10:00:00.000Z' },
                    },
                },
                processedAt: { type: 'string', example: '2023-10-31T10:00:00.000Z' },
            },
        },
    })
    @ApiResponse({
        status: 401,
        description: 'Unauthorized - Invalid or missing token',
    })
    @ApiResponse({
        status: 404,
        description: 'Prediction result not found',
    })
    async getPredictionResult(@Param('userId') userId: string) {
        this.logger.log(`Get prediction result request for user: ${userId}`);

        const result = await this.predictionService.getUserPredictionResult(userId);

        if (!result) {
            this.logger.log(`No prediction result found for user: ${userId}`);
            return {
                message: 'No prediction result found for this user',
                userId,
            };
        }

        return result;
    }
}