import { Controller, Logger } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { PredictionService } from './prediction.service';

@Controller()
export class PredictionProcessor {
    private readonly logger = new Logger(PredictionProcessor.name);

    constructor(private readonly predictionService: PredictionService) { }

    @EventPattern('process-batch')
    async handleRabbitMQBatchProcessing(data: { predictions: any[]; batchNumber: number }) {
        const { predictions, batchNumber } = data;

        this.logger.log(`Starting RabbitMQ batch ${batchNumber} with ${predictions.length} predictions`);

        try {
            await this.predictionService.processPredictionBatch(predictions);

            this.logger.log(`Successfully processed batch ${batchNumber} via RabbitMQ`);

            return {
                success: true,
                processedCount: predictions.length,
                batchNumber,
            };

        } catch (error) {
            this.logger.error(`Failed to process batch ${batchNumber} via RabbitMQ:`, error);
            throw error;
        }
    }
}