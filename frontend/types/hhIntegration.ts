export interface HhIntegrationStatus {
  connected: boolean;
  hhUserId?: string;
  expiresAt?: string;
  scopes?: string[];
  resumesCount?: number;
  expired?: boolean;
}
