import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, In } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { RedisService } from '@/shared/redis/redis.service';
import { Team } from '@/modules/team/entities/team.entity';
import { Prediction } from './entities/prediction.entity';
import { PredictionResult } from './entities/prediction-result.entity';
import { PredictionToProcess, ProcessedPrediction } from './interfaces/prediction.interface';
import { ScoringResult } from './interfaces/score.interface';

@Injectable()
export class PredictionService {
    private readonly logger = new Logger(PredictionService.name);
    private readonly IRAN_TEAM_ID: string;
    private readonly CORRECT_GROUPS_CACHE_KEY: string;
    private readonly CACHE_TTL: number;

    constructor(
        @InjectRepository(Team)
        private readonly teamRepository: Repository<Team>,
        @InjectRepository(Prediction)
        private readonly predictionRepository: Repository<Prediction>,
        @InjectRepository(PredictionResult)
        private readonly resultRepository: Repository<PredictionResult>,
        @Inject('RABBITMQ_SERVICE')
        private readonly rabbitmqClient: ClientProxy,
        private readonly redisService: RedisService,
        private readonly configService: ConfigService,
    ) {
        this.IRAN_TEAM_ID = this.configService.get<string>('prediction.iranTeamId') || 'bf5556ec-a78d-4047-a0f5-7b34b07c21aa';
        this.CORRECT_GROUPS_CACHE_KEY = this.configService.get<string>('prediction.correctGroupsCacheKey') || 'correct_groups';
        this.CACHE_TTL = this.configService.get<number>('prediction.correctGroupsCacheTtl') || 3600;
    }

    /**
     * Trigger prediction processing for all predictions
     * Uses RabbitMQ queue for scalable processing
     */
    async triggerPredictionProcessing(): Promise<{ message: string; queuedCount: number }> {
        try {
            this.logger.log('Starting prediction processing trigger');

            await this.rabbitmqClient.connect();

            // Get all predictions that haven't been processed or need reprocessing
            const predictions = await this.predictionRepository
                .createQueryBuilder('prediction')
                .leftJoin('prediction_results', 'result', 'result.prediction_id = prediction.id')
                .where('result.id IS NULL')
                .select(['prediction.id', 'prediction.userId', 'prediction.predict'])
                // .limit(10)
                .getMany();

            this.logger.log(`Found ${predictions.length} predictions to process`);

            // Process in batches of 1000
            const batchSize = 1000;
            let queuedCount = 0;

            for (let i = 0; i < predictions.length; i += batchSize) {
                const batch = predictions.slice(i, i + batchSize);

                // Publish batch to RabbitMQ
                this.rabbitmqClient.emit('process-batch', {
                    predictions: batch,
                    batchNumber: Math.floor(i / batchSize) + 1,
                });

                queuedCount += batch.length;
            }

            this.logger.log(`Queued ${queuedCount} predictions for processing`);

            return {
                message: 'Prediction processing started',
                queuedCount,
            };

        } catch (error) {
            this.logger.error('Failed to trigger prediction processing:', error);
            throw error;
        }
    }

    /**
     * Process a batch of predictions
     */
    async processPredictionBatch(predictions: PredictionToProcess[]): Promise<void> {
        this.logger.log(`Processing batch of ${predictions.length} predictions`);

        // Get correct groups from cache or database
        const correctGroups = await this.getCorrectGroups();

        const processedResults: Partial<PredictionResult>[] = [];

        for (const prediction of predictions) {
            try {
                const result = await this.processSinglePrediction(prediction, correctGroups);
                processedResults.push({
                    predictionId: prediction.id,
                    userId: prediction.userId,
                    totalScore: result.totalScore,
                    details: {
                        scoringResults: result.scoringResults,
                        processedAt: result.processedAt.toISOString(),
                    },
                    processedAt: result.processedAt,
                });
            } catch (error) {
                this.logger.error(`Failed to process prediction ${prediction.id}:`, error);
            }
        }

        // Bulk save results
        if (processedResults.length > 0) {
            await this.resultRepository.save(processedResults);
            this.logger.log(`Saved ${processedResults.length} prediction results`);
        }
    }

    /**
     * Process a single prediction with all 6 scoring modes
     */
    async processSinglePrediction(
        prediction: PredictionToProcess,
        correctGroups: Record<string, string[]>,
    ): Promise<ProcessedPrediction> {
        const userGroups = prediction.predict

        const scoringResults: ScoringResult[] = [];

        // Mode 1: All 48 teams in correct groups → 100 points
        scoringResults.push(this.checkMode1(userGroups, correctGroups));

        // Mode 2: Only 2 teams with wrong positions → 80 points
        scoringResults.push(this.checkMode2(userGroups, correctGroups));

        // Mode 3: Only 3 teams with wrong positions → 60 points
        scoringResults.push(this.checkMode3(userGroups, correctGroups));

        // Mode 4: All group mates of Iran team → 50 points
        scoringResults.push(this.checkMode4(userGroups, correctGroups));

        // Mode 5: One complete group (4 teams) correct → 40 points
        scoringResults.push(this.checkMode5(userGroups, correctGroups));

        // Mode 6: 3 teams from one group correct → 20 points
        scoringResults.push(this.checkMode6(userGroups, correctGroups));

        // Calculate total score (highest scoring mode wins)
        const totalScore = Math.max(...scoringResults.map(result => result.score));

        return {
            predictionId: prediction.id,
            userId: prediction.userId,
            totalScore,
            scoringResults,
            processedAt: new Date(),
        };
    }

    /**
     * Get prediction result for a specific user
     */
    async getUserPredictionResult(userId: string): Promise<PredictionResult | null> {
        return await this.resultRepository.findOne({
            where: { userId },
            order: { processedAt: 'DESC' },
        });
    }

    /**
     * Get correct groups from cache or database
     */
    private async getCorrectGroups(): Promise<Record<string, string[]>> {
        // Try to get from cache first
        let correctGroups = await this.redisService.get<Record<string, string[]>>(
            this.CORRECT_GROUPS_CACHE_KEY,
        );

        if (!correctGroups) {
            // Get from database
            const teams = await this.teamRepository.find({
                where: { group: In(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']) },
            });

            correctGroups = {};
            for (const team of teams) {
                if (!correctGroups[team.group!]) {
                    correctGroups[team.group!] = [];
                }
                correctGroups[team.group!].push(team.id);
            }

            // Cache for 1 hour
            await this.redisService.set(this.CORRECT_GROUPS_CACHE_KEY, correctGroups, this.CACHE_TTL);
        }

        return correctGroups;
    }

    // Scoring Mode Implementations

    private checkMode1(userGroups: Record<string, string[]>, correctGroups: Record<string, string[]>): ScoringResult {
        let correctTeams = 0;
        let totalTeams = 0;

        for (const [group, correctTeamIds] of Object.entries(correctGroups)) {
            const userTeamIds = userGroups[group]?.flat() || [];
            totalTeams += correctTeamIds.length;

            for (const teamId of correctTeamIds) {
                if (userTeamIds.includes(teamId)) {
                    correctTeams++;
                }
            }
        }

        const isAllCorrect = correctTeams === totalTeams && totalTeams === 48;

        return {
            mode: 'Mode 1',
            score: isAllCorrect ? 100 : 0,
            description: 'All 48 teams in correct groups',
            details: { correctTeams, totalTeams, achieved: isAllCorrect },
        };
    }

    private checkMode2(userGroups: Record<string, string[]>, correctGroups: Record<string, string[]>): ScoringResult {
        let wrongTeams = 0;

        for (const [group, correctTeamIds] of Object.entries(correctGroups)) {
            const userTeamIds = userGroups[group]?.flat() || [];

            for (const teamId of correctTeamIds) {
                if (!userTeamIds.includes(teamId)) {
                    wrongTeams++;
                }
            }
        }

        const achieved = wrongTeams <= 2;

        return {
            mode: 'Mode 2',
            score: achieved ? 80 : 0,
            description: 'Only 2 teams with wrong positions',
            details: { wrongTeams, achieved },
        };
    }

    private checkMode3(userGroups: Record<string, string[]>, correctGroups: Record<string, string[]>): ScoringResult {
        let wrongTeams = 0;

        for (const [group, correctTeamIds] of Object.entries(correctGroups)) {
            const userTeamIds = userGroups[group]?.flat() || [];

            for (const teamId of correctTeamIds) {
                if (!userTeamIds.includes(teamId)) {
                    wrongTeams++;
                }
            }
        }

        const achieved = wrongTeams <= 3;

        return {
            mode: 'Mode 3',
            score: achieved ? 60 : 0,
            description: 'Only 3 teams with wrong positions',
            details: { wrongTeams, achieved },
        };
    }

    private checkMode4(userGroups: Record<string, string[]>, correctGroups: Record<string, string[]>): ScoringResult {
        // Find Iran's correct group
        let iranGroup = '';
        for (const [group, teamIds] of Object.entries(correctGroups)) {
            if (teamIds.includes(this.IRAN_TEAM_ID)) {
                iranGroup = group;
                break;
            }
        }

        if (!iranGroup) {
            return {
                mode: 'Mode 4',
                score: 0,
                description: 'All group mates of Iran team',
                details: { iranGroup: null, achieved: false },
            };
        }

        const correctIranGroupTeams = correctGroups[iranGroup];
        const userIranGroupTeams = userGroups[iranGroup] || [];

        // Check if all Iran's group mates are correctly placed
        let allGroupMatesCorrect = true;
        for (const teamId of correctIranGroupTeams) {
            if (!userIranGroupTeams.includes(teamId)) {
                allGroupMatesCorrect = false;
                break;
            }
        }

        return {
            mode: 'Mode 4',
            score: allGroupMatesCorrect ? 50 : 0,
            description: 'All group mates of Iran team',
            details: {
                iranGroup,
                correctTeams: correctIranGroupTeams,
                userTeams: userIranGroupTeams,
                achieved: allGroupMatesCorrect,
            },
        };
    }

    private checkMode5(userGroups: Record<string, string[]>, correctGroups: Record<string, string[]>): ScoringResult {
        for (const [group, correctTeamIds] of Object.entries(correctGroups)) {
            const userTeamIds = userGroups[group]?.flat() || [];

            // Check if all 4 teams in this group are correct
            if (correctTeamIds.length === 4 && userTeamIds.length >= 4) {
                const allCorrect = correctTeamIds.every(teamId => userTeamIds.includes(teamId));

                if (allCorrect) {
                    return {
                        mode: 'Mode 5',
                        score: 40,
                        description: 'One complete group (4 teams) correct',
                        details: { group, correctTeams: correctTeamIds, achieved: true },
                    };
                }
            }
        }

        return {
            mode: 'Mode 5',
            score: 0,
            description: 'One complete group (4 teams) correct',
            details: { achieved: false },
        };
    }

    private checkMode6(userGroups: Record<string, string[]>, correctGroups: Record<string, string[]>): ScoringResult {
        for (const [group, correctTeamIds] of Object.entries(correctGroups)) {
            const userTeamIds = userGroups[group]?.flat() || [];

            // Count correct teams in this group
            let correctCount = 0;
            for (const teamId of correctTeamIds) {
                if (userTeamIds.includes(teamId)) {
                    correctCount++;
                }
            }

            if (correctCount >= 3) {
                return {
                    mode: 'Mode 6',
                    score: 20,
                    description: '3 teams from one group correct',
                    details: { group, correctCount, achieved: true },
                };
            }
        }

        return {
            mode: 'Mode 6',
            score: 0,
            description: '3 teams from one group correct',
            details: { achieved: false },
        };
    }
}