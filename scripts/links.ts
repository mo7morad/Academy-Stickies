/**
 * Print each member's magic sign-in link (for manual distribution).
 *
 *   npm run links
 *   npm run links:remote -- --site=https://stickies.yourdomain.com
 */
import { d1Query, isRemote, loadDevVars, siteUrl, type MemberRow } from "./util";

function main() {
  loadDevVars();
  const remote = isRemote();
  const base = siteUrl();

  const members = d1Query<MemberRow>(
    "SELECT name, email, login_token FROM members ORDER BY name COLLATE NOCASE",
    remote,
  );

  if (members.length === 0) {
    console.log("No members found. Run `npm run seed` first.");
    return;
  }

  console.log(`\nMagic links (${remote ? "remote" : "local"}) — base: ${base}\n`);
  for (const m of members) {
    console.log(`• ${m.name} <${m.email}>`);
    console.log(`  ${base}/api/auth?token=${m.login_token}\n`);
  }
}

main();
