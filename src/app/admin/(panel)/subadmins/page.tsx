import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { REGISTRAR_SELECT, type RegistrarRow } from "@/lib/registrars";
import { subBotUsername } from "@/lib/telegram-subadmin";
import SubAdminsManager from "@/components/admin/SubAdminsManager";

export const metadata = { title: "Sub-admins" };
export const dynamic = "force-dynamic";

export default async function SubAdminsPage() {
  await requireUser();
  const [rows, telegram, bot] = await Promise.all([
    query<RegistrarRow>(`${REGISTRAR_SELECT} order by r.status = 'active' desc, r.created_at desc`),
    query<{ registrar_id: number }>("select distinct registrar_id from registrar_telegram"),
    subBotUsername(),
  ]);
  const onTelegram = new Set(telegram.map((t) => t.registrar_id));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Sub-admins</h1>
          <p>
            People who only register donors, in the Omo Beeza app (Android, signing in with their phone number)
            {bot ? (
              <>
                {" "}
                or the{" "}
                <a href={`https://t.me/${bot}`} target="_blank" rel="noopener">
                  team Telegram bot
                </a>{" "}
                (iPhone)
              </>
            ) : null}
            . Each has a target: how many donors they are asked to register.
          </p>
        </div>
      </div>
      <SubAdminsManager rows={rows.map((r) => ({ ...r, telegram: onTelegram.has(r.id) }))} />
    </>
  );
}
