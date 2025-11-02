export interface SessionData {
    id: string;
    createdAt: string;
    expiresAt: string;
    userAgent: string | null;
    ipAddress: string | null;
    isActive: boolean;
}