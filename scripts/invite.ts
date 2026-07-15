/**
 * Email each member their magic sign-in link via Cloudflare Email Sending.
 * Requires CF_ACCOUNT_ID, CF_EMAIL_API_TOKEN, EMAIL_FROM (loaded from .dev.vars
 * locally, or your shell env).
 *
 *   npm run invite                       # local D1 roster
 *   npm run invite:remote -- --site=https://stickies.yourdomain.com
 *   npm run invite -- --dry-run          # print who would be emailed
 */
import { magicLinkTemplate } from "../lib/email";
import { d1Query, isRemote, loadDevVars, siteUrl, type MemberRow } from "./util";

async function send(
  accountId: string,
  apiToken: string,
  from: { address: string; name: string },
  to: string,
  name: string,
  link: string,
): Promise<void> {
  const { subject, html, text } = magicLinkTemplate(name, link);
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to, from, subject, html, text }),
    },
  );
  if (!res.ok) {
    throw new Error(`${res.status} ${await res.text()}`);
  }
}

async function main() {
  loadDevVars();
  const remote = isRemote();
  const dryRun = process.argv.includes("--dry-run");
  const base = siteUrl();

  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_EMAIL_API_TOKEN;
  const fromAddress = process.env.EMAIL_FROM;
  const fromName = process.env.EMAIL_FROM_NAME || "Academy Stickies";

  if (!dryRun && (!accountId || !apiToken || !fromAddress)) {
    console.error(
      "Missing email config. Set CF_ACCOUNT_ID, CF_EMAIL_API_TOKEN, EMAIL_FROM\n" +
        "(in .dev.vars or your shell), or run with --dry-run.",
    );
    process.exit(1);
  }

  const members = d1Query<MemberRow>(
    "SELECT name, email, login_token FROM members ORDER BY name COLLATE NOCASE",
    remote,
  );
  if (members.length === 0) {
    console.log("No members found. Run `npm run seed` first.");
    return;
  }

  console.log(
    `${dryRun ? "[dry-run] " : ""}Emailing ${members.length} member(s) — base ${base}\n`,
  );

  let ok = 0;
  for (const m of members) {
    const link = `${base}/api/auth?token=${m.login_token}`;
    if (dryRun) {
      console.log(`• would email ${m.name} <${m.email}>`);
      continue;
    }
    try {
      await send(
        accountId!,
        apiToken!,
        { address: fromAddress!, name: fromName },
        m.email,
        m.name,
        link,
      );
      console.log(`✓ ${m.email}`);
      ok++;
    } catch (err) {
      console.error(`✗ ${m.email}: ${err instanceof Error ? err.message : err}`);
    }
  }

  if (!dryRun) console.log(`\nSent ${ok}/${members.length}.`);
}

main();
