"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FormState } from "@/app/admin/actions/auth";
import { addAdmin, changePassword, removeAdmin } from "@/app/admin/actions/users";
import Icon from "@/components/Icon";

export interface AdminRow {
  id: number;
  name: string;
  email: string;
  created_at: string;
  last_login: string | null;
}

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "never");

function Notice({ state }: { state: FormState }) {
  if (state.error) return <p className="notice notice--error">{state.error}</p>;
  if (state.ok) return <p className="notice notice--ok">{state.ok}</p>;
  return null;
}

export default function UsersManager({ rows, meId }: { rows: AdminRow[]; meId: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [addState, addAction, adding] = useActionState(addAdmin, {});
  const [pwState, pwAction, changing] = useActionState(changePassword, {});

  return (
    <div className="two-col">
      <section className="panel">
        <div className="panel__head">
          <h2>Admins ({rows.length})</h2>
          <p>Everyone listed can sign in and edit the whole website.</p>
        </div>
        {error ? <p className="notice notice--error">{error}</p> : null}
        <div className="item-list">
          {rows.map((u) => (
            <div className="item" key={u.id}>
              <span className="thumb" style={{ display: "grid", placeItems: "center", fontWeight: 700 }}>
                {u.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="item__main">
                <strong>
                  {u.name} {u.id === meId ? <span className="pill pill--blue">You</span> : null}
                </strong>
                <span>
                  {u.email} · last sign-in {date(u.last_login)}
                </span>
              </div>
              {u.id !== meId ? (
                <button
                  type="button"
                  className="a-btn a-btn--danger a-btn--sm"
                  disabled={pending}
                  onClick={() =>
                    confirm(`Remove ${u.name}? They will no longer be able to sign in.`) &&
                    start(async () => {
                      const res = await removeAdmin(u.id);
                      setError(res.ok ? null : (res.error ?? "Not removed."));
                      router.refresh();
                    })
                  }
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <aside>
        <section className="panel">
          <div className="panel__head">
            <h2>Add an admin</h2>
          </div>
          <Notice state={addState} />
          <form action={addAction}>
            <div className="a-field">
              <label htmlFor="u-name">Name</label>
              <input id="u-name" name="name" required autoComplete="off" />
            </div>
            <div className="a-field">
              <label htmlFor="u-email">Email</label>
              <input id="u-email" name="email" type="email" required autoComplete="off" />
            </div>
            <div className="a-field">
              <label htmlFor="u-pass">Temporary password</label>
              <input id="u-pass" name="password" type="password" required minLength={10} autoComplete="new-password" />
              <span className="a-hint">At least 10 characters with letters and numbers. They can change it after signing in.</span>
            </div>
            <div className="form-actions">
              <button type="submit" className="a-btn a-btn--gold" disabled={adding}>
                <Icon name="users" /> {adding ? "Adding…" : "Add admin"}
              </button>
            </div>
          </form>
        </section>

        <section className="panel">
          <div className="panel__head">
            <h2>Change your password</h2>
          </div>
          <Notice state={pwState} />
          <form action={pwAction}>
            <div className="a-field">
              <label htmlFor="p-cur">Current password</label>
              <input id="p-cur" name="current" type="password" required autoComplete="current-password" />
            </div>
            <div className="a-field">
              <label htmlFor="p-new">New password</label>
              <input id="p-new" name="next" type="password" required minLength={10} autoComplete="new-password" />
            </div>
            <div className="a-field">
              <label htmlFor="p-conf">Repeat new password</label>
              <input id="p-conf" name="confirm" type="password" required minLength={10} autoComplete="new-password" />
            </div>
            <div className="form-actions">
              <button type="submit" className="a-btn a-btn--ghost" disabled={changing}>
                <Icon name="shield" /> {changing ? "Saving…" : "Change password"}
              </button>
            </div>
          </form>
        </section>
      </aside>
    </div>
  );
}
