"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addRegistrar, extendRegistrarTarget, removeRegistrar, updateRegistrar, type RegistrarForm } from "@/app/admin/actions/registrars";
import Icon from "@/components/Icon";
import { displayPhone } from "@/lib/giving";
import type { RegistrarRow } from "@/lib/registrars";

type Row = RegistrarRow & { telegram: boolean };
type Msg = { ok: boolean; text: string } | null;

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "never");
const EMPTY: RegistrarForm = { name: "", phone: "", password: "", target: 20 };

function Notice({ msg }: { msg: Msg }) {
  return msg ? <p className={`notice ${msg.ok ? "notice--ok" : "notice--error"}`}>{msg.text}</p> : null;
}

export default function SubAdminsManager({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [form, setForm] = useState<RegistrarForm>(EMPTY);
  const [editing, setEditing] = useState<number | null>(null);
  const [extra, setExtra] = useState<Record<number, string>>({});

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okText: string, after?: () => void) =>
    start(async () => {
      const res = await fn();
      setMsg(res.ok ? { ok: true, text: okText } : { ok: false, text: res.error ?? "Not saved." });
      if (res.ok) {
        after?.();
        router.refresh();
      }
    });

  const edit = (r: Row) => {
    setEditing(r.id);
    setForm({ name: r.name, phone: displayPhone(r.phone), password: "", target: r.target });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const reset = () => {
    setEditing(null);
    setForm(EMPTY);
  };
  const extend = (r: Row, n: number) => run(() => extendRegistrarTarget(r.id, n), `${r.name} can now register ${n} more.`);

  return (
    <div className="two-col">
      <section className="panel">
        <div className="panel__head">
          <h2>Sub-admins ({rows.length})</h2>
          <p>Progress toward each target. When someone reaches theirs, give them more with “+5”, “+10” or your own number; they can also do it themselves in the app or the bot.</p>
        </div>
        <Notice msg={editing === null ? msg : null} />
        {rows.length === 0 ? <p className="empty">No sub-admins yet. Add the first one on the right.</p> : null}
        <div className="item-list">
          {rows.map((r) => {
            const reached = r.target > 0 && r.registered >= r.target;
            const pct = r.target > 0 ? Math.min(100, Math.round((r.registered / r.target) * 100)) : 0;
            return (
              <div className="item" key={r.id} style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                <span className="thumb" style={{ display: "grid", placeItems: "center", fontWeight: 700 }}>
                  {r.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="item__main" style={{ minWidth: 220 }}>
                  <strong>
                    {r.name}{" "}
                    {r.status !== "active" ? <span className="pill">paused</span> : null}
                    {reached ? <span className="pill pill--ok">Target reached 🎉</span> : null}
                    {r.telegram ? <span className="pill pill--blue">Telegram</span> : null}
                  </strong>
                  <span style={{ display: "block" }}>
                    {displayPhone(r.phone)} · last sign-in {date(r.last_login)}
                  </span>
                  <span style={{ display: "block" }}>
                    <b>{r.registered}</b> of {r.target} donors registered{r.target > 0 ? ` (${pct}%)` : ""}
                  </span>
                  <div style={{ height: 6, background: "#eee6d8", borderRadius: 3, marginTop: 6, maxWidth: 320 }}>
                    <div style={{ width: `${pct}%`, height: 6, borderRadius: 3, background: reached ? "#3b8a5a" : "#d99a2b" }} />
                  </div>
                  <div className="btn-group" style={{ marginTop: 10, flexWrap: "wrap" }}>
                    <span className="a-hint" style={{ alignSelf: "center" }}>
                      Extend target:
                    </span>
                    <button type="button" className="a-btn a-btn--ghost a-btn--sm" disabled={pending} onClick={() => extend(r, 5)}>
                      +5
                    </button>
                    <button type="button" className="a-btn a-btn--ghost a-btn--sm" disabled={pending} onClick={() => extend(r, 10)}>
                      +10
                    </button>
                    <input
                      type="number"
                      min={1}
                      placeholder="+ how many"
                      aria-label={`Extra donors for ${r.name}`}
                      value={extra[r.id] ?? ""}
                      onChange={(e) => setExtra({ ...extra, [r.id]: e.target.value })}
                      style={{ width: 110 }}
                    />
                    <button
                      type="button"
                      className="a-btn a-btn--ghost a-btn--sm"
                      disabled={pending || !(Number(extra[r.id]) >= 1)}
                      onClick={() => extend(r, Number(extra[r.id]))}
                    >
                      Add
                    </button>
                  </div>
                </div>
                <div className="btn-group" style={{ marginLeft: "auto" }}>
                  <button type="button" className="a-btn a-btn--ghost a-btn--sm" disabled={pending} onClick={() => edit(r)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="a-btn a-btn--ghost a-btn--sm"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => updateRegistrar(r.id, { status: r.status === "active" ? "paused" : "active" }),
                        r.status === "active" ? `${r.name} is paused and signed out.` : `${r.name} can sign in again.`,
                      )
                    }
                  >
                    {r.status === "active" ? "Pause" : "Resume"}
                  </button>
                  <button
                    type="button"
                    className="a-btn a-btn--danger a-btn--sm"
                    disabled={pending}
                    onClick={() =>
                      confirm(`Remove ${r.name}? The donors they registered stay.`) && run(() => removeRegistrar(r.id), `${r.name} was removed.`)
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <aside>
        <section className="panel">
          <div className="panel__head">
            <h2>{editing === null ? "Add a sub-admin" : `Edit ${rows.find((r) => r.id === editing)?.name ?? ""}`}</h2>
          </div>
          <Notice msg={editing !== null ? msg : null} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editing === null) run(() => addRegistrar(form), `${form.name} was added. Send them the app or the bot, with their password.`, reset);
              else run(() => updateRegistrar(editing, form), "Saved.", reset);
            }}
          >
            <div className="a-field">
              <label htmlFor="r-name">Name</label>
              <input id="r-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoComplete="off" />
            </div>
            <div className="a-field">
              <label htmlFor="r-phone">Mobile number</label>
              <input id="r-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="09…" required />
              <span className="a-hint">They sign in with this number.</span>
            </div>
            <div className="a-field">
              <label htmlFor="r-pass">{editing === null ? "Password" : "New password (optional)"}</label>
              <input
                id="r-pass"
                type="text"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                minLength={8}
                required={editing === null}
                autoComplete="off"
              />
              <span className="a-hint">At least 8 characters. Give it to them yourself. {editing !== null ? "A new password signs them out." : ""}</span>
            </div>
            <div className="a-field">
              <label htmlFor="r-target">Target (donors to register)</label>
              <input id="r-target" type="number" min={0} value={form.target} onChange={(e) => setForm({ ...form, target: Number(e.target.value) })} />
            </div>
            <div className="form-actions">
              <button type="submit" className="a-btn a-btn--gold" disabled={pending}>
                <Icon name="users" /> {editing === null ? "Add sub-admin" : "Save"}
              </button>
              {editing !== null ? (
                <button type="button" className="a-btn a-btn--ghost" onClick={reset}>
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </section>
      </aside>
    </div>
  );
}
