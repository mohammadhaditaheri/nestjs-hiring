import { Test, TestingModule } from '@nestjs/testing';
import { PredictionProcessor } from './prediction.processor';
import { PredictionService } from './prediction.service';

describe('PredictionProcessor (RabbitMQ)', () => {
  let processor: PredictionProcessor;
  let mockPredictionService: jest.Mocked<Pick<PredictionService, 'processPredictionBatch'>>;

  beforeEach(async () => {
    mockPredictionService = {
      processPredictionBatch: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PredictionProcessor,
        {
          provide: PredictionService,
          useValue: mockPredictionService,
        },
      ],
    }).compile();

    processor = module.get<PredictionProcessor>(PredictionProcessor);
  });

  describe('handleRabbitMQBatchProcessing', () => {
    it('should process RabbitMQ batch successfully', async () => {
      const mockData = {
        predictions: [
          { id: 'pred-1', userId: 'user-1', predict: { groups: {} } },
          { id: 'pred-2', userId: 'user-2', predict: { groups: {} } },
        ],
        batchNumber: 1,
      };

      const result = await processor.handleRabbitMQBatchProcessing(mockData);

      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(2);
      expect(result.batchNumber).toBe(1);
      expect(mockPredictionService.processPredictionBatch).toHaveBeenCalledWith(
        mockData.predictions,
      );
    });

    it('should handle RabbitMQ processing errors', async () => {
      const mockData = {
        predictions: [{ id: 'pred-1', userId: 'user-1', predict: { groups: {} } }],
        batchNumber: 1,
      };

      mockPredictionService.processPredictionBatch.mockRejectedValue(
        new Error('RabbitMQ Processing failed'),
      );

      await expect(processor.handleRabbitMQBatchProcessing(mockData)).rejects.toThrow(
        'RabbitMQ Processing failed',
      );
    });
  });
});