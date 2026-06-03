const DEFAULT_BOOSTY_URL = 'https://boosty.to/leoai';

/** Public Boosty page for supporting LEO AI. Override via NEXT_PUBLIC_BOOSTY_URL. */
export function getBoostyUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_BOOSTY_URL?.trim();
  if (!fromEnv) return DEFAULT_BOOSTY_URL;
  return fromEnv.replace(/\/$/, '');
}
