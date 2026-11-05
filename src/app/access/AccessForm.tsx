"use client";

import { useActionState } from "react";
import { unlockSite } from "./actions";

export function AccessForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(unlockSite, { error: false });
  return (
    <form action={action} className="mt-10 space-y-6">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="access-password" className="text-sm text-graphite">
          პაროლი · Password
        </label>
        <input
          id="access-password"
          name="password"
          type="password"
          required
          autoFocus
          autoComplete="current-password"
          aria-invalid={state.error}
          aria-describedby={state.error ? "access-error" : undefined}
          className="field"
        />
        {state.error && (
          <p id="access-error" role="alert" className="mt-2 text-xs text-danger">
            პაროლი არასწორია · Incorrect password
          </p>
        )}
      </div>
      <button type="submit" disabled={pending} className="btn btn-solid w-full disabled:opacity-60">
        {pending ? "…" : "შესვლა · Enter"}
      </button>
    </form>
  );
}
