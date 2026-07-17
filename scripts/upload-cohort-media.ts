/**
 * Upload the optimized cohort photos built by build-cohort.ts into the R2 bucket.
 *
 *   npm run cohort:media          # local R2 (wrangler pages dev)
 *   npm run cohort:media:remote   # the deployed bucket
 *
 * Keys mirror the D1 photo_key values: learners/<slug>.webp, mentors/<slug>.webp.
 * They are only ever readable through the authenticated /api/media/* route.
 */
import { execFile } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { isRemote } from "./util";

const execFileAsync = promisify(execFile);

const MEDIA_DIR = ".cohort-media";
const BUCKET = "stickies-media";
const ATTEMPTS = 4;

// Remote R2 is a plain HTTP API and parallelises happily. Local storage is one
// SQLite file behind miniflare, and parallel writers hit lock contention, so it
// gets a narrower lane.
const CONCURRENCY = { remote: 8, local: 3 };

const WRANGLER = existsSync("node_modules/.bin/wrangler")
  ? "node_modules/.bin/wrangler"
  : "npx";

function wranglerArgs(rest: string[]): string[] {
  return WRANGLER === "npx" ? ["wrangler", ...rest] : rest;
}

interface Upload {
  key: string;
  file: string;
}

function collect(): Upload[] {
  const uploads: Upload[] = [];
  for (const group of ["learners", "mentors"]) {
    const dir = join(MEDIA_DIR, group);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".webp")) continue;
      uploads.push({ key: `${group}/${name}`, file: join(dir, name) });
    }
  }
  return uploads;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function putOne(upload: Upload, remote: boolean): Promise<void> {
  await execFileAsync(
    WRANGLER,
    wranglerArgs([
      "r2",
      "object",
      "put",
      `${BUCKET}/${upload.key}`,
      "--file",
      upload.file,
      "--content-type",
      "image/webp",
      // Private: the media route re-checks auth on every request, so this only
      // lets the member's own browser reuse the bytes.
      "--cache-control",
      "private, max-age=86400",
      remote ? "--remote" : "--local",
    ]),
    { maxBuffer: 1024 * 1024 },
  );
}

/** Storage contention and transient API errors are both worth another go. */
async function putWithRetry(upload: Upload, remote: boolean): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      await putOne(upload, remote);
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < ATTEMPTS) await sleep(250 * 2 ** (attempt - 1));
    }
  }
  throw lastErr;
}

/** Bounded worker pool — wrangler spawns are slow, but R2 dislikes a 200-wide burst. */
async function run(uploads: Upload[], remote: boolean): Promise<number> {
  const lanes = Math.min(
    remote ? CONCURRENCY.remote : CONCURRENCY.local,
    uploads.length,
  );
  let next = 0;
  let done = 0;
  let failed = 0;

  async function worker(): Promise<void> {
    while (next < uploads.length) {
      const upload = uploads[next++];
      try {
        await putWithRetry(upload, remote);
      } catch (err) {
        failed++;
        const detail = String((err as Error).message)
          .split("\n")
          .find((l) => /error|ERROR/.test(l));
        console.error(`  ! ${upload.key}: ${detail ?? (err as Error).message}`);
      }
      done++;
      if (done % 25 === 0 || done === uploads.length) {
        console.log(`  ${done}/${uploads.length}`);
      }
    }
  }

  await Promise.all(Array.from({ length: lanes }, worker));
  return failed;
}

async function main() {
  const uploads = collect();
  if (!uploads.length) {
    console.error(
      `No photos in ${MEDIA_DIR}/. Run \`npm run cohort\` first to build them.`,
    );
    process.exit(1);
  }

  const remote = isRemote();
  console.log(
    `Uploading ${uploads.length} photo(s) to ${remote ? "REMOTE" : "LOCAL"} R2 (${BUCKET})…`,
  );

  const started = Date.now();
  const failed = await run(uploads, remote);
  const secs = ((Date.now() - started) / 1000).toFixed(1);

  if (failed) {
    console.error(`\n${failed} upload(s) failed after ${secs}s.`);
    process.exit(1);
  }
  console.log(`\nUploaded ${uploads.length} photo(s) in ${secs}s.`);
}

main();
