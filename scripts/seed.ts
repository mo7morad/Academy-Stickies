/**
 * Load seed/roster.json into D1, generating a unique login token per member.
 * Idempotent: re-running updates names but keeps existing tokens/rows.
 *
 *   npm run seed          # local D1
 *   npm run seed:remote   # deployed D1
 */
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { d1ExecFile, isRemote, sqlQuote } from "./util";

interface RosterEntry {
  name: string;
  email: string;
}

function token(): string {
  return randomBytes(32).toString("base64url");
}

function main() {
  const remote = isRemote();
  const roster = JSON.parse(
    readFileSync("seed/roster.json", "utf8"),
  ) as RosterEntry[];

  if (!Array.isArray(roster) || roster.length === 0) {
    console.error("seed/roster.json is empty.");
    process.exit(1);
  }

  const now = Date.now();
  const statements = roster.map((m) => {
    const name = (m.name || "").trim();
    const email = (m.email || "").trim().toLowerCase();
    if (!name || !email) {
      throw new Error(`Every roster entry needs a name and email: ${JSON.stringify(m)}`);
    }
    return (
      `INSERT INTO members (id, name, email, login_token, wall_public, created_at) ` +
      `VALUES (${sqlQuote(randomUUID())}, ${sqlQuote(name)}, ${sqlQuote(email)}, ` +
      `${sqlQuote(token())}, 0, ${now}) ` +
      `ON CONFLICT(email) DO UPDATE SET name = excluded.name;`
    );
  });

  const file = "scripts/.generated.seed.sql";
  writeFileSync(file, statements.join("\n") + "\n");

  console.log(
    `Seeding ${roster.length} member(s) into ${remote ? "REMOTE" : "LOCAL"} D1…`,
  );
  d1ExecFile(file, remote);
  console.log("\nDone. Run `npm run links` to see each member's magic link.");
}

main();
