import { useState } from "preact/hooks";
import { sendFeedback } from "../api";
import { Icon } from "../components/Icon";
import { Spinner } from "../components/controls";
import { useToast } from "../toast";

const MAX_FEEDBACK_LEN = 2000;

export function SendFeedback({ onSent }: { onSent: () => void }) {
  const toast = useToast();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const canSubmit = message.trim().length > 0;

  async function submit() {
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      await sendFeedback(message.trim());
      toast("Thanks — sent.");
      onSent();
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Couldn't send that.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="give">
      <div class="group__header">What's on your mind?</div>
      <div class="group">
        <div class="field-wrap">
          <textarea
            class="field field--multiline"
            placeholder="Bugs, ideas, anything at all…"
            maxLength={MAX_FEEDBACK_LEN}
            value={message}
            aria-label="Feedback"
            onInput={(e) => setMessage((e.target as HTMLTextAreaElement).value)}
          />
          <div class="field-count">
            {message.length}/{MAX_FEEDBACK_LEN}
          </div>
        </div>
      </div>

      <button
        class="btn btn--filled btn--full btn--lg"
        disabled={!canSubmit || busy}
        onClick={submit}
      >
        {busy ? (
          <Spinner />
        ) : (
          <>
            <Icon name="paperplane" size={18} /> Send feedback
          </>
        )}
      </button>
    </div>
  );
}
