"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import type { AppFileInfo, AppKey } from "@/lib/apps";

interface AppCard {
  key: AppKey;
  name: string;
  descr: string;
  file: AppFileInfo | null;
}

type Msg = { ok: boolean; text: string } | null;

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
const date = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** "OmoBeezaAdmin-v1.6.0.apk" → "1.6.0". */
const versionFrom = (name: string) => name.match(/v?(\d+(?:\.\d+){1,3})/i)?.[1] ?? "";

function AppPanel({ app }: { app: AppCard }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [inputKey, setInputKey] = useState(0);
  const current = app.file;

  const send = () => {
    if (!file) return;
    const form = new FormData();
    form.append("app", app.key);
    form.append("version", version);
    form.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/apps");
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      setProgress(null);
      let body: { error?: string; version?: string } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status === 200) {
        setMsg({ ok: true, text: `Version ${body.version} uploaded. Download it below to install it on the phones.` });
        setFile(null);
        setVersion("");
        setInputKey((k) => k + 1);
        router.refresh();
      } else {
        setMsg({ ok: false, text: body.error ?? (xhr.status === 413 ? "The file is too large for the server." : `Upload failed (${xhr.status}).`) });
      }
    };
    xhr.onerror = () => {
      setProgress(null);
      setMsg({ ok: false, text: "Network error during the upload. Please try again." });
    };
    setMsg(null);
    setProgress(0);
    xhr.send(form);
  };

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>{app.name}</h2>
        <p>{app.descr}</p>
      </div>
      {msg ? <p className={`notice ${msg.ok ? "notice--ok" : "notice--error"}`}>{msg.text}</p> : null}

      {current ? (
        <>
          <ul className="q-log" style={{ marginTop: 0 }}>
            <li>
              <span>Current version</span>
              <span className="pill pill--ok">v{current.version}</span>
            </li>
            <li>
              <span>File</span>
              <span>
                {current.file_name} · {mb(current.size)}
              </span>
            </li>
            <li>
              <span>Uploaded</span>
              <span>
                {date(current.uploaded_at)}
                {current.uploaded_by ? ` by ${current.uploaded_by}` : ""}
              </span>
            </li>
          </ul>
          <a className="a-btn a-btn--gold" href={`/api/admin/apps/${app.key}`} download={current.file_name} style={{ marginTop: 12 }}>
            <Icon name="download" /> Download v{current.version}
          </a>
          <p className="a-hint" style={{ marginTop: 8, wordBreak: "break-all" }}>
            SHA-256: {current.sha256}
          </p>
        </>
      ) : (
        <p className="empty" style={{ marginTop: 0 }}>
          Not uploaded yet. Upload the APK below.
        </p>
      )}

      <div style={{ borderTop: "1px solid var(--a-line, #e8e1d5)", marginTop: 18, paddingTop: 16 }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>{current ? "Upload a new version" : "Upload the app"}</h3>
        <div className="form-grid">
          <div className="a-field">
            <label htmlFor={`apk-${app.key}`}>APK file</label>
            <input
              key={inputKey}
              id={`apk-${app.key}`}
              type="file"
              accept=".apk,application/vnd.android.package-archive"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f) setVersion(versionFrom(f.name));
              }}
            />
          </div>
          <div className="a-field">
            <label htmlFor={`ver-${app.key}`}>Version</label>
            <input id={`ver-${app.key}`} value={version} onChange={(e) => setVersion(e.target.value)} placeholder="for example 1.7.0" />
            <span className="a-hint">Filled in from the file name when it has one (…-v1.6.0.apk).</span>
          </div>
        </div>
        <button type="button" className="a-btn" disabled={!file || !version.trim() || progress !== null} onClick={send}>
          <Icon name="upload" /> {progress !== null ? `Uploading… ${progress}%` : current ? "Upload and replace" : "Upload"}
        </button>
      </div>
    </section>
  );
}

export default function AppsManager({ apps }: { apps: AppCard[] }) {
  return (
    <>
      <div className="two-col">
        {apps.map((a) => (
          <AppPanel key={a.key} app={a} />
        ))}
      </div>
      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panel__head">
          <h2>Installing or updating on a phone</h2>
        </div>
        <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
          <li>On the Android phone, open this dashboard in the browser (Chrome), sign in, go to Android apps and tap Download.</li>
          <li>Open the downloaded file. The first time, Android asks to allow installing apps from Chrome: allow it, then go back.</li>
          <li>
            Tap <b>Install</b> (or <b>Update</b>). An update keeps the app’s data and sign-in. Or download it here on the computer and send the
            file to the phone, for example on Telegram.
          </li>
        </ol>
        <p className="a-hint" style={{ marginTop: 10 }}>
          A new version must be signed with the same key as the installed one, otherwise Android refuses to update it (“App not installed”). The
          versions built for you are all signed with the ministry’s key. iPhone sub-admins use the sub-admin Telegram bot instead.
        </p>
      </section>
    </>
  );
}
