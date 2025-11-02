import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { PredictionService } from './prediction.service';
import { RedisService } from '../../shared/redis/redis.service';
import { Team } from '../team/entities/team.entity';
import { Prediction } from './entities/prediction.entity';
import { PredictionResult } from './entities/prediction-result.entity';

describe('PredictionService - 6 Scoring Modes', () => {
    let service: PredictionService;
    let mockTeamRepository: any;
    let mockPredictionRepository: any;
    let mockResultRepository: any;
    let mockRabbitClient: any;
    let mockRedisService: any;
    let mockConfigService: any;

    // Test data - Iran team ID (will be read from config)
    let IRAN_TEAM_ID: string;
    let correctGroups: any;

    beforeEach(async () => {
        mockTeamRepository = {
            find: jest.fn(),
        };

        mockPredictionRepository = {
            createQueryBuilder: jest.fn(() => ({
                leftJoin: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([]),
            })),
        };

        mockResultRepository = {
            save: jest.fn(),
            findOne: jest.fn(),
        };

        mockRabbitClient = {
            connect: jest.fn().mockResolvedValue(undefined),
            emit: jest.fn().mockResolvedValue(null),
        };

        mockRedisService = {
            get: jest.fn().mockResolvedValue(correctGroups),
            set: jest.fn(),
        };

        mockConfigService = {
            get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
                const config: Record<string, any> = {
                    'prediction.iranTeamId': process.env.IRAN_TEAM_ID || 'bf5556ec-a78d-4047-a0f5-7b34b07c21aa',
                    'prediction.correctGroupsCacheKey': 'correct_groups',
                    'prediction.correctGroupsCacheTtl': 3600,
                };
                return config[key] || defaultValue;
            }),
        };

        // Get Iran team ID from config
        IRAN_TEAM_ID = mockConfigService.get('prediction.iranTeamId');

        // Mock correct groups for World Cup 2026 (12 groups, 4 teams each)
        correctGroups = {
            A: ['team-A-1', 'team-A-2', 'team-A-3', 'team-A-4'],
            B: ['team-B-1', IRAN_TEAM_ID, 'team-B-3', 'team-B-4'], // Iran in group B
            C: ['team-C-1', 'team-C-2', 'team-C-3', 'team-C-4'],
            D: ['team-D-1', 'team-D-2', 'team-D-3', 'team-D-4'],
            E: ['team-E-1', 'team-E-2', 'team-E-3', 'team-E-4'],
            F: ['team-F-1', 'team-F-2', 'team-F-3', 'team-F-4'],
            G: ['team-G-1', 'team-G-2', 'team-G-3', 'team-G-4'],
            H: ['team-H-1', 'team-H-2', 'team-H-3', 'team-H-4'],
            I: ['team-I-1', 'team-I-2', 'team-I-3', 'team-I-4'],
            J: ['team-J-1', 'team-J-2', 'team-J-3', 'team-J-4'],
            K: ['team-K-1', 'team-K-2', 'team-K-3', 'team-K-4'],
            L: ['team-L-1', 'team-L-2', 'team-L-3', 'team-L-4'],
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PredictionService,
                {
                    provide: getRepositoryToken(Team),
                    useValue: mockTeamRepository,
                },
                {
                    provide: getRepositoryToken(Prediction),
                    useValue: mockPredictionRepository,
                },
                {
                    provide: getRepositoryToken(PredictionResult),
                    useValue: mockResultRepository,
                },
                {
                    provide: 'RABBITMQ_SERVICE',
                    useValue: mockRabbitClient,
                },
                {
                    provide: RedisService,
                    useValue: mockRedisService,
                },
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();

        service = module.get<PredictionService>(PredictionService);
    });

    describe('Scoring Mode 1: All 48 teams in correct groups (100 points)', () => {
        it('should give 100 points for perfect prediction', async () => {
            const prediction = {
                id: 'pred-1',
                userId: 'user-1',
                predict: correctGroups, // Perfect prediction
            };

            const result = await service.processSinglePrediction(prediction, correctGroups);

            expect(result.totalScore).toBe(100);

            const mode1Result = result.scoringResults.find(r => r.mode === 'Mode 1');
            expect(mode1Result.score).toBe(100);
            expect(mode1Result.details.correctTeams).toBe(48);
            expect(mode1Result.details.totalTeams).toBe(48);
            expect(mode1Result.details.achieved).toBe(true);
        });

        it('should give 0 points when not all teams are correct', async () => {
            const userGroups = { ...correctGroups };
            userGroups.A = ['wrong-1', 'wrong-2', 'wrong-3', 'wrong-4']; // 4 wrong teams

            const prediction = {
                id: 'pred-1',
                userId: 'user-1',
                predict: userGroups
            };

            const result = await service.processSinglePrediction(prediction, correctGroups);

            const mode1Result = result.scoringResults.find(r => r.mode === 'Mode 1');
            expect(mode1Result.score).toBe(0);
            expect(mode1Result.details.correctTeams).toBe(44); // 48 - 4 wrong
            expect(mode1Result.details.achieved).toBe(false);
        });
    });

    describe('Scoring Mode 2: Only 2 teams with wrong positions (80 points)', () => {
        it('should give 80 points when exactly 2 teams are wrong', async () => {
            const userGroups = { ...correctGroups };
            // Move 2 teams to wrong positions
            userGroups.A = ['wrong-1', 'team-A-2', 'team-A-3', 'team-A-4'];
            userGroups.B = ['wrong-2', IRAN_TEAM_ID, 'team-B-3', 'team-B-4'];

            const prediction = {
                id: 'pred-1',
                userId: 'user-1',
                predict: userGroups
            };

            const result = await service.processSinglePrediction(prediction, correctGroups);

            const mode2Result = result.scoringResults.find(r => r.mode === 'Mode 2');
            expect(mode2Result.score).toBe(80);
            expect(mode2Result.details.wrongTeams).toBe(2);
            expect(mode2Result.details.achieved).toBe(true);
        });

        it('should give 0 points when more than 2 teams are wrong', async () => {
            const userGroups = { ...correctGroups };
            // Move 3 teams to wrong positions
            userGroups.A = ['wrong-1', 'wrong-2', 'wrong-3', 'team-A-4'];

            const prediction = {
                id: 'pred-1',
                userId: 'user-1',
                predict: userGroups
            };

            const result = await service.processSinglePrediction(prediction, correctGroups);

            const mode2Result = result.scoringResults.find(r => r.mode === 'Mode 2');
            expect(mode2Result.score).toBe(0);
            expect(mode2Result.details.wrongTeams).toBe(3);
            expect(mode2Result.details.achieved).toBe(false);
        });

        it('should give 80 points when 1 team is wrong (≤2 rule)', async () => {
            const userGroups = { ...correctGroups };
            userGroups.A = ['wrong-1', 'team-A-2', 'team-A-3', 'team-A-4'];

            const prediction = {
                id: 'pred-1',
                userId: 'user-1',
                predict: userGroups,
            };

            const result = await service.processSinglePrediction(prediction, correctGroups);

            const mode2Result = result.scoringResults.find(r => r.mode === 'Mode 2');
            expect(mode2Result.score).toBe(80);
            expect(mode2Result.details.wrongTeams).toBe(1);
            expect(mode2Result.details.achieved).toBe(true);
        });
    });

    describe('Scoring Mode 3: Only 3 teams with wrong positions (60 points)', () => {
        it('should give 60 points when exactly 3 teams are wrong', async () => {
            const userGroups = { ...correctGroups };
            userGroups.A = ['wrong-1', 'wrong-2', 'wrong-3', 'team-A-4'];

            const prediction = {
                id: 'pred-1',
                userId: 'user-1',
                predict: userGroups
            };

            const result = await service.processSinglePrediction(prediction, correctGroups);

            const mode3Result = result.scoringResults.find(r => r.mode === 'Mode 3');
            expect(mode3Result.score).toBe(60);
            expect(mode3Result.details.wrongTeams).toBe(3);
            expect(mode3Result.details.achieved).toBe(true);
        });

        it('should give 0 points when more than 3 teams are wrong', async () => {
            const userGroups = { ...correctGroups };
            userGroups.A = ['wrong-1', 'wrong-2', 'wrong-3', 'wrong-4'];

            const prediction = {
                id: 'pred-1',
                userId: 'user-1',
                predict: userGroups
            };

            const result = await service.processSinglePrediction(prediction, correctGroups);

            const mode3Result = result.scoringResults.find(r => r.mode === 'Mode 3');
            expect(mode3Result.score).toBe(0);
            expect(mode3Result.details.wrongTeams).toBe(4);
            expect(mode3Result.details.achieved).toBe(false);
        });
    });

    describe('Scoring Mode 4: All group mates of Iran team (50 points)', () => {
        it('should give 50 points when Iran group is completely correct', async () => {
            const userGroups = {
                A: ['wrong-1', 'wrong-2', 'wrong-3', 'wrong-4'],
                B: ['team-B-1', IRAN_TEAM_ID, 'team-B-3', 'team-B-4'], // Iran group correct
                C: ['wrong-1', 'wrong-2', 'wrong-3', 'wrong-4'],
                // ... other groups wrong
            };

            const prediction = {
                id: 'pred-1',
                userId: 'user-1',
                predict: userGroups,
            };

            const result = await service.processSinglePrediction(prediction, correctGroups);

            const mode4Result = result.scoringResults.find(r => r.mode === 'Mode 4');
            expect(mode4Result.score).toBe(50);
            expect(mode4Result.details.iranGroup).toBe('B');
            expect(mode4Result.details.achieved).toBe(true);
            expect(mode4Result.details.correctTeams).toEqual(correctGroups.B);
            expect(mode4Result.details.userTeams).toEqual(userGroups.B);
        });

        it('should give 0 points when Iran group is incomplete', async () => {
            const userGroups = {
                A: ['wrong-1', 'wrong-2', 'wrong-3', 'wrong-4'],
                B: ['wrong-1', IRAN_TEAM_ID, 'team-B-3', 'team-B-4'], // Iran group partially wrong
                C: ['wrong-1', 'wrong-2', 'wrong-3', 'wrong-4'],
            };

            const prediction = {
                id: 'pred-1',
                userId: 'user-1',
                predict: userGroups,
            };

            const result = await service.processSinglePrediction(prediction, correctGroups);

            const mode4Result = result.scoringResults.find(r => r.mode === 'Mode 4');
            expect(mode4Result.score).toBe(0);
            expect(mode4Result.details.achieved).toBe(false);
        });

        it('should handle case when Iran team is not found in correct groups', async () => {
            const wrongCorrectGroups = { ...correctGroups };
            wrongCorrectGroups.B = ['team-B-1', 'team-B-2', 'team-B-3', 'team-B-4']; // Iran not in groups

            const prediction = {
                id: 'pred-1',
                userId: 'user-1',
                predict: correctGroups
            };

            const result = await service.processSinglePrediction(prediction, wrongCorrectGroups);

            const mode4Result = result.scoringResults.find(r => r.mode === 'Mode 4');
            expect(mode4Result.score).toBe(0);
            expect(mode4Result.details.iranGroup).toBeNull();
            expect(mode4Result.details.achieved).toBe(false);
        });
    });

    describe('Scoring Mode 5: One complete group (4 teams) correct (40 points)', () => {
        it('should give 40 points when at least one complete group is correct', async () => {
            const userGroups = {
                A: ['team-A-1', 'team-A-2', 'team-A-3', 'team-A-4'], // Complete group A correct
                B: ['wrong-1', 'wrong-2', 'wrong-3', 'wrong-4'],
                C: ['wrong-1', 'wrong-2', 'wrong-3', 'wrong-4'],
                // ... other groups wrong
            };

            const prediction = {
                id: 'pred-1',
                userId: 'user-1',
                predict: userGroups
            };

            const result = await service.processSinglePrediction(prediction, correctGroups);

            const mode5Result = result.scoringResults.find(r => r.mode === 'Mode 5');
            expect(mode5Result.score).toBe(40);
            expect(mode5Result.details.group).toBe('A');
            expect(mode5Result.details.correctTeams).toEqual(correctGroups.A);
            expect(mode5Result.details.achieved).toBe(true);
        });

        it('should give 0 points when no complete group is correct', async () => {
            const userGroups = {
                A: ['team-A-1', 'team-A-2', 'team-A-3', 'wrong-4'], // 3/4 correct
                B: ['team-B-1', IRAN_TEAM_ID, 'wrong-3', 'team-B-4'], // 3/4 correct
                C: ['wrong-1', 'wrong-2', 'wrong-3', 'wrong-4'], // 0/4 correct
            };

            const prediction = {
                id: 'pred-1',
                userId: 'user-1',
                predict: userGroups
            };

            const result = await service.processSinglePrediction(prediction, correctGroups);

            const mode5Result = result.scoringResults.find(r => r.mode === 'Mode 5');
            expect(mode5Result.score).toBe(0);
            expect(mode5Result.details.achieved).toBe(false);
        });

        it('should prioritize first complete group found', async () => {
            const userGroups = {
                A: ['team-A-1', 'team-A-2', 'team-A-3', 'team-A-4'], // Complete
                B: ['team-B-1', IRAN_TEAM_ID, 'team-B-3', 'team-B-4'], // Also complete
                C: ['wrong-1', 'wrong-2', 'wrong-3', 'wrong-4'],
            };

            const prediction = {
                id: 'pred-1',
                userId: 'user-1',
                predict: userGroups
            };

            const result = await service.processSinglePrediction(prediction, correctGroups);

            const mode5Result = result.scoringResults.find(r => r.mode === 'Mode 5');
            expect(mode5Result.score).toBe(40);
            expect(mode5Result.details.group).toBe('A'); // First group found
            expect(mode5Result.details.achieved).toBe(true);
        });
    });

    describe('Scoring Mode 6: 3 teams from one group correct (20 points)', () => {
        it('should give 20 points when at least one group has 3+ correct teams', async () => {
            const userGroups = {
                A: ['team-A-1', 'team-A-2', 'team-A-3', 'wrong-4'], // 3/4 correct
                B: ['wrong-1', 'wrong-2', 'wrong-3', 'wrong-4'], // 0/4 correct
                C: ['wrong-1', 'wrong-2', 'wrong-3', 'wrong-4'], // 0/4 correct
            };

            const prediction = {
                id: 'pred-1',
                userId: 'user-1',
                predict: userGroups
            };

            const result = await service.processSinglePrediction(prediction, correctGroups);

            const mode6Result = result.scoringResults.find(r => r.mode === 'Mode 6');
            expect(mode6Result.score).toBe(20);
            expect(mode6Result.details.group).toBe('A');
            expect(mode6Result.details.correctCount).toBe(3);
            expect(mode6Result.details.achieved).toBe(true);
        });

        it('should give 0 points when no group has 3+ correct teams', async () => {
            const userGroups = {
                A: ['team-A-1', 'team-A-2', 'wrong-3', 'wrong-4'], // 2/4 correct
                B: ['team-B-1', 'wrong-2', 'wrong-3', 'wrong-4'], // 1/4 correct
                C: ['wrong-1', 'wrong-2', 'wrong-3', 'wrong-4'], // 0/4 correct
            };

            const prediction = {
                id: 'pred-1',
                userId: 'user-1',
                predict: userGroups
            };

            const result = await service.processSinglePrediction(prediction, correctGroups);

            const mode6Result = result.scoringResults.find(r => r.mode === 'Mode 6');
            expect(mode6Result.score).toBe(0);
            expect(mode6Result.details.achieved).toBe(false);
        });

        it('should count exactly 4 correct teams as valid for mode 6', async () => {
            const userGroups = {
                A: ['team-A-1', 'team-A-2', 'team-A-3', 'team-A-4'], // 4/4 correct
                B: ['wrong-1', 'wrong-2', 'wrong-3', 'wrong-4'],
            };

            const prediction = {
                id: 'pred-1',
                userId: 'user-1',
                predict: userGroups
            };

            const result = await service.processSinglePrediction(prediction, correctGroups);

            const mode6Result = result.scoringResults.find(r => r.mode === 'Mode 6');
            expect(mode6Result.score).toBe(20);
            expect(mode6Result.details.correctCount).toBe(4);
            expect(mode6Result.details.achieved).toBe(true);
        });
    });

    describe('Total Score Calculation', () => {
        it('should return the highest score among all modes', async () => {
            // Scenario: Perfect Iran group (Mode 4: 50) + 3 correct in another group (Mode 6: 20)
            const userGroups = {
                A: ['team-A-1', 'team-A-2', 'team-A-3', 'wrong-4'], // 3 correct → Mode 6: 20 points
                B: ['team-B-1', IRAN_TEAM_ID, 'team-B-3', 'team-B-4'], // Perfect Iran group → Mode 4: 50 points
                C: ['wrong-1', 'wrong-2', 'wrong-3', 'wrong-4'],
                // ... rest wrong
            };

            const prediction = {
                id: 'pred-1',
                userId: 'user-1',
                predict: userGroups
            };

            const result = await service.processSinglePrediction(prediction, correctGroups);

            // Should get 50 points (highest among Mode 4: 50, Mode 6: 20)
            expect(result.totalScore).toBe(50);
        });

        it('should handle all modes scoring 0', async () => {
            const userGroups = {
                A: ['wrong-1', 'wrong-2', 'wrong-3', 'wrong-4'],
                B: ['wrong-1', 'wrong-2', 'wrong-3', 'wrong-4'],
                C: ['wrong-1', 'wrong-2', 'wrong-3', 'wrong-4'],
                // ... all wrong
            };

            const prediction = {
                id: 'pred-1',
                userId: 'user-1',
                predict: userGroups
            };

            const result = await service.processSinglePrediction(prediction, correctGroups);

            expect(result.totalScore).toBe(0);
            result.scoringResults.forEach(mode => {
                expect(mode.score).toBe(0);
            });
        });
    });

    describe('Edge Cases and Position Independence', () => {
        it('should ignore team position within group (only group membership matters)', async () => {
            const userGroups = {
                // Same teams as correct group A, but in different order
                A: ['team-A-4', 'team-A-1', 'team-A-3', 'team-A-2'], // Different order, same teams
                B: ['wrong-1', 'wrong-2', 'wrong-3', 'wrong-4'],
            };

            const prediction = {
                id: 'pred-1',
                userId: 'user-1',
                predict: userGroups
            };

            const result = await service.processSinglePrediction(prediction, correctGroups);

            // Should still get Mode 5: 40 points for complete group A
            const mode5Result = result.scoringResults.find(r => r.mode === 'Mode 5');
            expect(mode5Result.score).toBe(40);
            expect(mode5Result.details.achieved).toBe(true);
        });

        it('should handle empty user groups', async () => {
            const prediction = {
                id: 'pred-1',
                userId: 'user-1',
                predict: {}, // Empty groups
            };

            const result = await service.processSinglePrediction(prediction, correctGroups);

            expect(result.totalScore).toBe(0);
            result.scoringResults.forEach(mode => {
                expect(mode.score).toBe(0);
                expect(mode.details.achieved).toBe(false);
            });
        });

        it('should handle missing groups in user prediction', async () => {
            const prediction = {
                id: 'pred-1',
                userId: 'user-1',
                predict: {
                    A: ['team-A-1', 'team-A-2', 'team-A-3', 'team-A-4'],
                    // Groups B, C, D, etc. are missing
                },
            };

            const result = await service.processSinglePrediction(prediction, correctGroups);

            // Should still get Mode 5: 40 points for complete group A
            const mode5Result = result.scoringResults.find(r => r.mode === 'Mode 5');
            expect(mode5Result.score).toBe(40);
        });

        it('should handle extra teams in user groups', async () => {
            const userGroups = {
                A: ['team-A-1', 'team-A-2', 'team-A-3', 'team-A-4', 'extra-team'], // 5 teams instead of 4
                B: ['team-B-1', IRAN_TEAM_ID, 'team-B-3', 'team-B-4'],
            };

            const prediction = {
                id: 'pred-1',
                userId: 'user-1',
                predict: userGroups
            };

            const result = await service.processSinglePrediction(prediction, correctGroups);

            // Should still recognize complete groups despite extra teams
            const mode5Result = result.scoringResults.find(r => r.mode === 'Mode 5');
            expect(mode5Result.score).toBe(40);
        });
    });

    describe('Performance and Scalability', () => {
        it('should process large batch efficiently', async () => {
            const largeBatch = Array.from({ length: 1000 }, (_, i) => ({
                id: `pred-${i}`,
                userId: `user-${i}`,
                predict: correctGroups,
            }));

            const startTime = Date.now();
            await service.processPredictionBatch(largeBatch);
            const processingTime = Date.now() - startTime;

            console.log(`Processed ${largeBatch.length} predictions in ${processingTime}ms`);
            expect(processingTime).toBeLessThan(2000); // Should process 1000 in under 2 seconds
        });

        it('should trigger prediction processing', async () => {
            // Mock the query builder to return empty result
            const mockQueryBuilder = {
                createQueryBuilder: jest.fn().mockReturnThis(),
                leftJoin: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([]),
            };

            mockPredictionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

            const result = await service.triggerPredictionProcessing();

            expect(result.message).toBe('Prediction processing started');
            expect(result.queuedCount).toBe(0);
            expect(mockRabbitClient.connect).toHaveBeenCalledTimes(1);
            expect(mockRabbitClient.emit).not.toHaveBeenCalled();
        });

        it('should queue predictions in batches of 1000', async () => {
            // Mock large number of predictions
            const mockQueryBuilder = {
                leftJoin: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue(
                    Array.from({ length: 2500 }, (_, i) => ({
                        id: `pred-${i}`,
                        userId: `user-${i}`,
                        predict: { groups: {} },
                    }))
                ),
            };

            mockPredictionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

            const result = await service.triggerPredictionProcessing();

            expect(result.queuedCount).toBe(2500);
            expect(mockRabbitClient.emit).toHaveBeenCalledTimes(3); // 3 batches: 1000 + 1000 + 500
            expect(mockRabbitClient.emit).toHaveBeenCalledWith('process-batch', expect.objectContaining({ batchNumber: 1 }));
        });
    });
});