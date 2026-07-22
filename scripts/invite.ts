/**
 * Email each member their magic sign-in link via Brevo.
 * Requires BREVO_API_KEY, EMAIL_FROM (loaded from .dev.vars locally, or your
 * shell env). EMAIL_FROM must be a sender address verified in Brevo.
 *
 *   npm run invite                       # local D1 roster
 *   npm run invite:remote -- --site=https://stickies.yourdomain.com
 *   npm run invite -- --dry-run          # print who would be emailed
 */
import { magicLinkTemplate } from "../lib/email";
import { d1Query, isRemote, loadDevVars, siteUrl, type MemberRow } from "./util";

async function send(
  apiKey: string,
  from: { email: string; name: string },
  to: string,
  name: string,
  link: string,
): Promise<void> {
  const { subject, html, text } = magicLinkTemplate(name, link);
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: from,
      to: [{ email: to, name }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${await res.text()}`);
  }
}

async function main() {
  loadDevVars();
  const remote = isRemote();
  const dryRun = process.argv.includes("--dry-run");
  const base = siteUrl();

  const apiKey = process.env.BREVO_API_KEY;
  const fromAddress = process.env.EMAIL_FROM;
  const fromName = process.env.EMAIL_FROM_NAME || "Academy Stickies";

  if (!dryRun && (!apiKey || !fromAddress)) {
    console.error(
      "Missing email config. Set BREVO_API_KEY, EMAIL_FROM\n" +
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
  let skipped = 0;
  for (const m of members) {
    // Mentors imported without a real address carry a placeholder that can't be
    // mailed — hand them their link from `npm run links` instead.
    if (m.email.endsWith("@no-email.invalid")) {
      console.log(`— skip ${m.name}: no email on file`);
      skipped++;
      continue;
    }
    const link = `${base}/api/auth?token=${m.login_token}`;
    if (dryRun) {
      console.log(`• would email ${m.name} <${m.email}>`);
      continue;
    }
    try {
      await send(
        apiKey!,
        { email: fromAddress!, name: fromName },
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

  if (!dryRun) {
    console.log(`\nSent ${ok}/${members.length - skipped}.`);
    if (skipped) {
      console.log(`Skipped ${skipped} with no email — run \`npm run links\` for their links.`);
    }
  }
}

main();
