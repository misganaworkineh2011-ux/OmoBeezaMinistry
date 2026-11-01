"use client";

import { useActionState } from "react";
import { bootstrap, login, type FormState } from "@/app/admin/actions/auth";

export default function LoginForm({ firstRun }: { firstRun: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(firstRun ? bootstrap : login, {});

  return (
    <form action={action}>
      {firstRun ? (
        <p className="notice notice--info">
          No admin accounts exist yet. Create yours now — you can add other admins from the dashboard afterwards.
        </p>
      ) : null}
      {state.error ? (
        <p className="notice notice--error" role="alert">
          {state.error}
        </p>
      ) : null}

      {firstRun ? (
        <div className="a-field">
          <label htmlFor="name">Your name</label>
          <input id="name" name="name" autoComplete="name" required />
        </div>
      ) : null}
      <div className="a-field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="a-field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={firstRun ? "new-password" : "current-password"}
          required
        />
        {firstRun ? <span className="a-hint">At least 10 characters, with letters and numbers.</span> : null}
      </div>
      {firstRun ? (
        <div className="a-field">
          <label htmlFor="confirm">Confirm password</label>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
        </div>
      ) : null}

      <button className="a-btn" type="submit" disabled={pending}>
        {pending ? "Please wait…" : firstRun ? "Create account" : "Sign in"}
      </button>
    </form>
  );
}
