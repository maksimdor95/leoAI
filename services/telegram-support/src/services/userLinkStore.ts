import fs from 'fs';
import path from 'path';

const dataDir = path.resolve(__dirname, '../../data');
const linksFile = path.join(dataDir, 'user-links.json');

type LinkMap = Record<string, string>;

let cache: LinkMap | null = null;

function ensureDataDir(): void {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function load(): LinkMap {
  if (cache) return cache;
  ensureDataDir();
  if (!fs.existsSync(linksFile)) {
    cache = {};
    return cache;
  }
  try {
    const raw = fs.readFileSync(linksFile, 'utf8');
    cache = JSON.parse(raw) as LinkMap;
  } catch {
    cache = {};
  }
  return cache!;
}

function persist(links: LinkMap): void {
  ensureDataDir();
  fs.writeFileSync(linksFile, JSON.stringify(links, null, 2), 'utf8');
  cache = links;
}

export function linkTelegramToSite(telegramUserId: number, siteUserId: string): void {
  const trimmed = siteUserId.trim();
  if (!trimmed) return;
  const links = load();
  links[String(telegramUserId)] = trimmed;
  persist(links);
}

export function getSiteUserId(telegramUserId: number): string | undefined {
  return load()[String(telegramUserId)];
}
