import { useState } from "preact/hooks";
import { requestLink } from "../api";
import { Spinner } from "../components/controls";
import { useToast } from "../toast";

export function Login() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const params = new URLSearchParams(location.search);
  const linkError = params.get("error");

  async function submit(e: Event) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      const res = await requestLink(email.trim());
      if (res.reason === "email-not-configured") {
        toast(
          "Email isn't set up yet — ask your admin to send your link.",
          "error",
        );
      } else {
        setDone(true);
        toast("If you're on the roster, your link is on its way.");
      }
    } catch {
      toast("Something went wrong. Try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main class="center-screen">
      <div class="login-logo" aria-hidden="true">
        🗒️
      </div>
      <h1 style="font-size:var(--text-title1);font-weight:700;letter-spacing:-0.4px;">
        Academy Stickies
      </h1>
      <p style="color:var(--label-secondary);max-width:320px;margin-top:var(--sp-2);">
        A private wall of kind, honest notes between academy members. Sign in with
        the unique link sent to your academy email.
      </p>

      {linkError && (
        <p style="color:var(--danger);margin-top:var(--sp-4);font-size:var(--text-subhead);">
          {linkError === "badlink"
            ? "That link is invalid or expired."
            : "That link was missing its token."}
        </p>
      )}

      <div class="login-card">
        {done ? (
          <div class="group" style="padding:var(--sp-5);text-align:center;">
            <div style="font-size:32px;">📬</div>
            <p style="margin-top:var(--sp-2);color:var(--label-secondary);">
              Check your inbox for your private sign-in link.
            </p>
          </div>
        ) : (
          <form class="group" onSubmit={submit}>
            <div class="field-wrap">
              <input
                class="field"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@binb.idserve.net"
                value={email}
                onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
                aria-label="Academy email"
              />
            </div>
            <div style="padding:var(--sp-3) var(--sp-4) var(--sp-4);">
              <button class="btn btn--filled btn--full btn--lg" disabled={busy}>
                {busy ? <Spinner /> : "Email me my link"}
              </button>
            </div>
          </form>
        )}
        <p style="text-align:center;color:var(--label-tertiary);font-size:var(--text-footnote);margin-top:var(--sp-2);">
          Only invited academy members can sign in.
        </p>
      </div>
    </main>
  );
}
