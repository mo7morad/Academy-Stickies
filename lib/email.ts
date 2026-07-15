// Cloudflare Email Sending via the REST API. On Pages, the REST API is the
// reliable path (the `send_email` binding is Workers-oriented).
// Docs: https://developers.cloudflare.com/email-service/

export interface EmailEnv {
  CF_ACCOUNT_ID?: string;
  CF_EMAIL_API_TOKEN?: string;
  EMAIL_FROM?: string;
  EMAIL_FROM_NAME?: string;
}

export function emailConfigured(env: EmailEnv): boolean {
  return Boolean(env.CF_ACCOUNT_ID && env.CF_EMAIL_API_TOKEN && env.EMAIL_FROM);
}

export async function sendMagicLink(
  env: EmailEnv,
  to: string,
  name: string,
  link: string,
): Promise<void> {
  if (!emailConfigured(env)) {
    throw new Error(
      "Email is not configured (need CF_ACCOUNT_ID, CF_EMAIL_API_TOKEN, EMAIL_FROM).",
    );
  }
  const { subject, html, text } = magicLinkTemplate(name, link);
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/email/sending/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CF_EMAIL_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to,
        from: {
          address: env.EMAIL_FROM,
          name: env.EMAIL_FROM_NAME || "Academy Stickies",
        },
        subject,
        html,
        text,
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Email send failed (${res.status}): ${body}`);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function magicLinkTemplate(
  name: string,
  link: string,
): { subject: string; html: string; text: string } {
  const safeName = escapeHtml(name.split(" ")[0] || name);
  const safeLink = escapeHtml(link);
  const subject = "Your private link to Academy Stickies";
  const text = [
    `Hi ${name},`,
    "",
    "Here's your private link to Academy Stickies. Open it to sign in — no password needed.",
    "",
    link,
    "",
    "This link is unique to you. Keep it private; anyone with it can sign in as you.",
    "",
    "— Academy Stickies",
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f2f2f7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f7;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.08);">
          <tr><td style="padding:36px 32px 8px;text-align:center;font-size:44px;line-height:1;">🗒️</td></tr>
          <tr><td style="padding:8px 32px 0;text-align:center;">
            <h1 style="margin:0;font-size:24px;font-weight:700;color:#1c1c1e;letter-spacing:-0.4px;">Academy Stickies</h1>
          </td></tr>
          <tr><td style="padding:16px 32px 0;color:#3a3a3c;font-size:16px;line-height:1.5;">
            Hi ${safeName}, here's your private link to sign in — no password needed.
          </td></tr>
          <tr><td style="padding:28px 32px;text-align:center;">
            <a href="${safeLink}" style="display:inline-block;background:#007aff;color:#ffffff;text-decoration:none;font-size:17px;font-weight:600;padding:14px 28px;border-radius:14px;">Open Academy Stickies</a>
          </td></tr>
          <tr><td style="padding:0 32px 28px;color:#8e8e93;font-size:13px;line-height:1.5;">
            This link is unique to you. Keep it private — anyone with it can sign in as you.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}

export async function sendStickyNotification(
  env: EmailEnv,
  to: string,
  recipientName: string,
  authorName: string,
  link: string,
): Promise<void> {
  if (!emailConfigured(env)) {
    console.warn("Skipping sticky email notification: email not configured");
    return;
  }
  const { subject, html, text } = stickyNotificationTemplate(recipientName, authorName, link);
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/email/sending/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CF_EMAIL_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to,
        from: {
          address: env.EMAIL_FROM,
          name: env.EMAIL_FROM_NAME || "Academy Stickies",
        },
        subject,
        html,
        text,
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    console.error(`Email send failed (${res.status}): ${body}`);
  }
}

export function stickyNotificationTemplate(
  recipientName: string,
  authorName: string,
  link: string,
): { subject: string; html: string; text: string } {
  const safeRecipientName = escapeHtml(recipientName.split(" ")[0] || recipientName);
  const safeAuthorName = escapeHtml(authorName);
  const safeLink = escapeHtml(link);
  const subject = `${safeAuthorName} left a sticky on your wall!`;
  const text = [
    `Hi ${safeRecipientName},`,
    "",
    `${safeAuthorName} just left a new sticky note on your wall!`,
    "",
    `See what they wrote: ${link}`,
    "",
    "— Academy Stickies",
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#fdfbf7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdfbf7;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#ffffff;border:3px solid #2d2d2d;border-radius:12px;overflow:hidden;box-shadow:4px 4px 0px 0px #2d2d2d;">
          <tr><td style="padding:36px 32px 8px;text-align:center;font-size:44px;line-height:1;">🎉</td></tr>
          <tr><td style="padding:8px 32px 0;text-align:center;">
            <h1 style="margin:0;font-size:24px;font-weight:700;color:#2d2d2d;letter-spacing:-0.4px;">New Sticky Note!</h1>
          </td></tr>
          <tr><td style="padding:16px 32px 0;color:#2d2d2d;font-size:16px;line-height:1.5;">
            Hi ${safeRecipientName}, <strong>${safeAuthorName}</strong> just left a new sticky note on your wall!
          </td></tr>
          <tr><td style="padding:28px 32px;text-align:center;">
            <a href="${safeLink}" style="display:inline-block;background:#ff4d4d;color:#ffffff;text-decoration:none;font-size:17px;font-weight:700;padding:12px 24px;border:3px solid #2d2d2d;border-radius:8px;box-shadow:2px 2px 0px 0px #2d2d2d;">View Your Wall</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}
