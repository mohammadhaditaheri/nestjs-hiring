export interface AuthResponse {
    token: string;
    user: {
        id: string;
        phone: string;
        isVerified: boolean;
    };
}