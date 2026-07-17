import { useState } from "preact/hooks";
import { requestLink } from "../api";
import { Spinner } from "../components/controls";
import { useToast } from "../toast";

export function Login() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const linkError = new URLSearchParams(location.search).get("error");

  async function submit(e: Event) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      const res = await requestLink(email.trim());
      if (res.reason === "email-not-configured") {
        toast("Email isn't set up yet — ask your admin to send your link.", "error");
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
      <h1 class="login-title">Academy Stickies</h1>
      <p class="login-sub">
        A private wall of kind, honest notes between academy members. Sign in with
        the unique link sent to your academy email.
      </p>

      {linkError && (
        <p class="login-error" role="alert">
          {linkError === "badlink"
            ? "That link is invalid or expired."
            : "That link was missing its token."}
        </p>
      )}

      <div class="login-card">
        {done ? (
          <div class="group login-done">
            <div class="login-done__emoji" aria-hidden="true">
              📬
            </div>
            <p>Check your inbox for your private sign-in link.</p>
          </div>
        ) : (
          <form class="group login-form" onSubmit={submit}>
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
                required
              />
            </div>
            <div class="login-form__action">
              <button class="btn btn--filled btn--full btn--lg" disabled={busy}>
                {busy ? <Spinner /> : "Email me my link"}
              </button>
            </div>
          </form>
        )}
        <p class="login-foot">Only invited academy members can sign in.</p>
      </div>
    </main>
  );
}
