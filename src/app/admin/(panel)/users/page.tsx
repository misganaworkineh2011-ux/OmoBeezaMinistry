import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import UsersManager, { type AdminRow } from "@/components/admin/UsersManager";

export const metadata = { title: "Admins" };
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await requireUser();
  const rows = await query<AdminRow>("select id, name, email, created_at, last_login from users order by created_at");

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Admins</h1>
          <p>The people who can sign in to this dashboard.</p>
        </div>
      </div>
      <UsersManager rows={rows} meId={me.id} />
    </>
  );
}
