/**
 * Phase 0 smoke: extended-only ingest (no HH/SJ), persist after each connector.
 *
 * Usage:
 *   cd services/job-matching && npx ts-node --transpile-only scripts/scrape-extended-only.ts
 */

import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function main(): Promise<void> {
  const { scrapeExtendedOnly, DEFAULT_SEED_KEYWORDS } = await import('../src/services/scraper');

  const keywords =
    process.argv.slice(2).length > 0
      ? process.argv.slice(2)
      : [...DEFAULT_SEED_KEYWORDS].slice(0, 5);

  console.log(
    JSON.stringify(
      {
        enableExtended: process.env.ENABLE_EXTENDED_JOB_SOURCES,
        extendedSources: process.env.EXTENDED_JOB_SOURCES || 'all',
        keywords,
      },
      null,
      2
    )
  );

  const started = Date.now();
  const result = await scrapeExtendedOnly(keywords, { enrich: false });
  const ms = Date.now() - started;

  console.log(
    JSON.stringify(
      {
        ok: result.success,
        ms,
        jobsScraped: result.jobsScraped,
        jobsSaved: result.jobsSaved,
        sourcesUsed: result.sourcesUsed,
        errors: result.errors,
      },
      null,
      2
    )
  );

  if (!result.success) {
    process.exitCode = 1;
  }

  // Allow open handles (pg/redis from imports) to exit.
  process.exit(result.success ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
