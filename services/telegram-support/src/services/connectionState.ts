let telegramReachable = false;
let lastSuccessAt: number | null = null;
let lastErrorAt: number | null = null;
let consecutiveErrors = 0;

export function markTelegramSuccess(): void {
  telegramReachable = true;
  lastSuccessAt = Date.now();
  consecutiveErrors = 0;
}

export function markTelegramError(): void {
  telegramReachable = false;
  lastErrorAt = Date.now();
  consecutiveErrors += 1;
}

export function getConnectionState(): {
  connected: boolean;
  lastSuccessAt: number | null;
  lastErrorAt: number | null;
  consecutiveErrors: number;
} {
  return {
    connected: telegramReachable,
    lastSuccessAt,
    lastErrorAt,
    consecutiveErrors,
  };
}
