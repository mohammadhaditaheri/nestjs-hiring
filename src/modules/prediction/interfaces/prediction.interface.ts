import { ScoringResult } from "./score.interface";

export interface ProcessedPrediction {
    predictionId: string;
    userId: string;
    totalScore: number;
    scoringResults: ScoringResult[];
    processedAt: Date;
}

export interface PredictionToProcess {
    id: string;
    userId: string;
    predict: Record<string, string[]>;
}
