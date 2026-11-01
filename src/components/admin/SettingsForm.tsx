"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSite } from "@/app/admin/actions/settings";
import type { SiteSettings } from "@/lib/site";
import Icon from "@/components/Icon";

export default function SettingsForm({ initial }: { initial: SiteSettings }) {
  const router = useRouter();
  const [site, setSite] = useState<SiteSettings>(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const set = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => {
    setSite((s) => ({ ...s, [key]: value }));
    setMsg(null);
  };

  const save = () =>
    start(async () => {
      const res = await saveSite(site);
      setMsg(res.ok ? { ok: true, text: "Saved. The website has been updated." } : { ok: false, text: res.error ?? "Not saved." });
      if (res.ok) router.refresh();
    });

  return (
    <>
      <div className="two-col">
        <section className="panel">
          <div className="panel__head">
            <h2>Contact</h2>
          </div>
          <div className="a-field">
            <label htmlFor="email">Email address</label>
            <input id="email" type="email" value={site.email} onChange={(e) => set("email", e.target.value)} />
            <span className="a-hint">Shown across the site and used for form copies.</span>
          </div>
          <div className="a-field">
            <span className="a-label">Phone numbers</span>
            {site.phones.map((p, i) => (
              <div className="btn-group" key={i}>
                <input
                  className="a-input"
                  style={{ flex: 1 }}
                  value={p}
                  aria-label={`Phone ${i + 1}`}
                  onChange={(e) => set("phones", site.phones.map((x, j) => (j === i ? e.target.value : x)))}
                />
                <button type="button" className="a-btn a-btn--danger a-btn--icon" aria-label="Remove phone" onClick={() => set("phones", site.phones.filter((_, j) => j !== i))}>
                  <Icon name="close" />
                </button>
              </div>
            ))}
            <div>
              <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => set("phones", [...site.phones, ""])}>
                + Add phone
              </button>
            </div>
          </div>
          <div className="a-field">
            <span className="a-label">Team contacts (Contact page)</span>
            {site.namedContacts.map((c, i) => (
              <div className="btn-group" key={i}>
                <input
                  className="a-input"
                  style={{ flex: 1 }}
                  placeholder="Name"
                  value={c.name}
                  onChange={(e) => set("namedContacts", site.namedContacts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                />
                <input
                  className="a-input"
                  style={{ flex: 1 }}
                  placeholder="Phone"
                  value={c.phone}
                  onChange={(e) => set("namedContacts", site.namedContacts.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))}
                />
                <button type="button" className="a-btn a-btn--danger a-btn--icon" aria-label="Remove contact" onClick={() => set("namedContacts", site.namedContacts.filter((_, j) => j !== i))}>
                  <Icon name="close" />
                </button>
              </div>
            ))}
            <div>
              <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => set("namedContacts", [...site.namedContacts, { name: "", phone: "" }])}>
                + Add contact
              </button>
            </div>
          </div>
          <div className="a-field">
            <label htmlFor="map">Map embed link (Google Maps)</label>
            <input id="map" value={site.mapEmbed} onChange={(e) => set("mapEmbed", e.target.value)} />
            <span className="a-hint">In Google Maps: Share → Embed a map → copy only the https://… link from inside src=&quot;…&quot;.</span>
          </div>
        </section>

        <div>
          <section className="panel">
            <div className="panel__head">
              <h2>Bank transfer (Donate page)</h2>
            </div>
            <div className="a-field">
              <label htmlFor="bank">Bank</label>
              <input id="bank" value={site.bank.name} onChange={(e) => set("bank", { ...site.bank, name: e.target.value })} />
            </div>
            <div className="a-field">
              <label htmlFor="acctName">Account name</label>
              <input id="acctName" value={site.bank.accountName} onChange={(e) => set("bank", { ...site.bank, accountName: e.target.value })} />
            </div>
            <div className="a-field">
              <label htmlFor="acctNo">Account number</label>
              <input id="acctNo" value={site.bank.accountNumber} onChange={(e) => set("bank", { ...site.bank, accountNumber: e.target.value })} />
              <span className="a-hint">Double-check this number — donors will copy it.</span>
            </div>
          </section>

          <section className="panel">
            <div className="panel__head">
              <h2>Social media</h2>
            </div>
            {(["facebook", "instagram", "telegram", "linkedin"] as const).map((k) => (
              <div className="a-field" key={k}>
                <label htmlFor={k}>{k[0].toUpperCase() + k.slice(1)}</label>
                <input id={k} value={site.social[k]} placeholder="https://…" onChange={(e) => set("social", { ...site.social, [k]: e.target.value })} />
              </div>
            ))}
          </section>
        </div>
      </div>

      <div className="sticky-save">
        {msg ? (
          <div className={`notice notice--${msg.ok ? "ok" : "error"}`} style={{ margin: 0 }} role="status">
            <Icon name={msg.ok ? "check" : "info"} /> {msg.text}
          </div>
        ) : null}
        <span className="spacer" />
        <button type="button" className="a-btn a-btn--gold" onClick={save} disabled={pending}>
          <Icon name="check" /> {pending ? "Saving…" : "Save settings"}
        </button>
      </div>
    </>
  );
}
