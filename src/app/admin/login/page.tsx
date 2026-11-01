import { redirect } from "next/navigation";
import { hasDb } from "@/lib/db";
import { countUsers, getCurrentUser } from "@/lib/auth";
import LoginForm from "@/components/admin/LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (!hasDb()) {
    return (
      <main className="login">
        <div className="login__card">
          <div className="login__brand">
            <img src="/img/emblem.png" alt="" />
            <div>
              <h1>Dashboard not set up</h1>
              <p>Omo Beeza Ministry</p>
            </div>
          </div>
          <p>
            The database isn&apos;t configured. Add <code>DATABASE_URL</code> (your Neon connection string) to the
            environment variables and redeploy. See the README for step-by-step setup.
          </p>
        </div>
      </main>
    );
  }

  if (await getCurrentUser()) redirect("/admin");
  const firstRun = (await countUsers()) === 0;

  return (
    <main className="login">
      <div className="login__card">
        <div className="login__brand">
          <img src="/img/emblem.png" alt="" />
          <div>
            <h1>{firstRun ? "Create the first admin" : "Sign in"}</h1>
            <p>Omo Beeza Ministry dashboard</p>
          </div>
        </div>
        <LoginForm firstRun={firstRun} />
      </div>
    </main>
  );
}
