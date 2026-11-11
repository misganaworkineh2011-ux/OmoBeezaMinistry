// Database tables. Every statement is idempotent, so the list is simply run
// on the first query of each server process (see src/lib/db/index.ts).
// To change a table later, append an `alter table … add column if not exists …`.

export const SCHEMA: string[] = [
  `create table if not exists users (
    id serial primary key,
    email text unique not null,
    name text not null,
    password_hash text not null,
    created_at timestamptz not null default now(),
    last_login timestamptz
  )`,
  `create table if not exists sessions (
    id text primary key,
    user_id int not null references users(id) on delete cascade,
    expires_at timestamptz not null,
    created_at timestamptz not null default now()
  )`,
  // Site text: one row per locale + message namespace (e.g. en/home), layered
  // over messages/<locale>.json.
  `create table if not exists content (
    locale text not null,
    ns text not null,
    data jsonb not null,
    updated_at timestamptz not null default now(),
    updated_by text,
    primary key (locale, ns)
  )`,
  `create table if not exists settings (
    key text primary key,
    data jsonb not null,
    updated_at timestamptz not null default now()
  )`,
  `create table if not exists posts (
    id serial primary key,
    slug text unique not null,
    date date not null default current_date,
    cover text not null default '',
    author text not null default 'Omo Beeza Ministry',
    title_en text not null,
    title_am text not null default '',
    excerpt_en text not null default '',
    excerpt_am text not null default '',
    body_en text not null default '',
    body_am text not null default '',
    published boolean not null default true,
    updated_at timestamptz not null default now()
  )`,
  `create table if not exists children (
    id serial primary key,
    slug text unique not null,
    name text not null,
    portrait text not null,
    portrait_w int not null default 600,
    portrait_h int not null default 900,
    card text,
    card_w int,
    card_h int,
    sort int not null default 0,
    active boolean not null default true,
    prayers int not null default 0
  )`,
  `create table if not exists prayer_log (
    id serial primary key,
    child_slug text not null,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists albums (
    id text primary key,
    title_en text not null,
    title_am text not null default '',
    tag_en text not null default '',
    tag_am text not null default '',
    descr_en text not null default '',
    descr_am text not null default '',
    icon text not null default 'sparkles',
    sort int not null default 0,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists photos (
    id serial primary key,
    album_id text not null references albums(id) on delete cascade,
    src text not null,
    w int not null,
    h int not null,
    caption text not null default '',
    sort int not null default 0
  )`,
  `create table if not exists videos (
    id text primary key,
    kind text not null default 'reel',
    src text not null,
    preview text not null default '',
    poster text not null default '',
    w int not null,
    h int not null,
    duration int not null default 0,
    title_en text not null default '',
    title_am text not null default '',
    tag_en text not null default '',
    tag_am text not null default '',
    sort int not null default 0,
    active boolean not null default true
  )`,
  `create table if not exists knowledge_docs (
    id serial primary key,
    title text not null,
    file_url text,
    chars int not null default 0,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists knowledge_chunks (
    id serial primary key,
    doc_id int not null references knowledge_docs(id) on delete cascade,
    part int not null,
    text text not null
  )`,
  `create table if not exists submissions (
    id serial primary key,
    type text not null,
    name text not null default '',
    email text not null default '',
    data jsonb not null,
    status text not null default 'new',
    created_at timestamptz not null default now()
  )`,
  `create table if not exists chat_logs (
    id serial primary key,
    question text not null,
    locale text not null default 'en',
    created_at timestamptz not null default now()
  )`,
  `create table if not exists analytics (
    day date not null,
    path text not null,
    event text not null,
    count int not null default 0,
    primary key (day, path, event)
  )`,
  // Bundled media files copied to Blob storage: original path → Blob URL.
  `create table if not exists media_map (
    path text primary key,
    url text not null,
    created_at timestamptz not null default now()
  )`,
  // Chatbot conversations, for reviewing what visitors ask and spotting
  // answers the assistant couldn't give (flag = 'no_info' / 'off_topic').
  `create table if not exists chat_conversations (
    id text primary key,
    locale text not null default 'en',
    page text not null default '',
    started_at timestamptz not null default now(),
    last_at timestamptz not null default now(),
    turns int not null default 0,
    unanswered int not null default 0,
    reviewed boolean not null default false
  )`,
  `create table if not exists chat_messages (
    id serial primary key,
    conversation_id text not null references chat_conversations(id) on delete cascade,
    role text not null,
    content text not null,
    flag text not null default '',
    created_at timestamptz not null default now()
  )`,
  `alter table chat_messages add column if not exists resolved boolean not null default false`,
  `create index if not exists chat_messages_conv on chat_messages (conversation_id, id)`,
  `create index if not exists chat_conversations_last on chat_conversations (last_at desc)`,
  // Weekly givers (registered on the Donations page or added in the dashboard).
  `create table if not exists donors (
    id serial primary key,
    name text not null,
    phone text not null unique,
    email text not null default '',
    amount int not null,
    reminder_day int not null default 0,
    status text not null default 'active',
    locale text not null default 'en',
    token text not null unique,
    notes text not null default '',
    source text not null default 'website',
    created_at timestamptz not null default now(),
    last_reminded_at timestamptz,
    stopped_at timestamptz
  )`,
  `create table if not exists donor_payments (
    id serial primary key,
    donor_id int not null references donors(id) on delete cascade,
    amount int not null,
    paid_on date not null default current_date,
    reference text not null default '',
    note text not null default '',
    created_by text not null default '',
    created_at timestamptz not null default now()
  )`,
  `create table if not exists sms_log (
    id serial primary key,
    donor_id int references donors(id) on delete set null,
    to_phone text not null,
    message text not null,
    kind text not null,
    status text not null,
    provider_id text not null default '',
    error text not null default '',
    created_at timestamptz not null default now()
  )`,
  // Set when the donor was added (and verified) in AfroMessage contacts from
  // the Android app's guided step — only needed while AfroMessage is in beta.
  `alter table donors add column if not exists afro_contact_at timestamptz`,
  // Telegram reminders: the donor's @username (optional) and, once they press
  // Start on the bot, the chat the bot may message.
  `alter table donors add column if not exists telegram_username text not null default ''`,
  `alter table donors add column if not exists telegram_chat_id text`,
  `alter table donors add column if not exists telegram_linked_at timestamptz`,
  `alter table sms_log add column if not exists channel text not null default 'sms'`,
  // When the donor was sent the SMS invitation to the bot, and what happened
  // when the ministry's Telegram account tried to reach them ('ok',
  // 'not_on_telegram', 'blocked', ...).
  `alter table donors add column if not exists telegram_invited_at timestamptz`,
  `alter table donors add column if not exists telegram_user_status text not null default ''`,
  `alter table donors add column if not exists telegram_user_checked_at timestamptz`,
  // Step-by-step sign-up inside the Telegram bot (one row per chat).
  `create table if not exists telegram_sessions (
    chat_id text primary key,
    step text not null,
    data jsonb not null default '{}',
    updated_at timestamptz not null default now()
  )`,
  // What to call the donor in messages ("Abebe" for "Abebe Kebede Tadesse").
  `alter table donors add column if not exists nickname text not null default ''`,
  // Website donors sign up with their email and app donors with their phone,
  // so the phone may be empty ('') — but is still unique when given.
  `alter table donors drop constraint if exists donors_phone_key`,
  `create unique index if not exists donors_phone_unique on donors (phone) where phone <> ''`,
  `create index if not exists donors_email on donors (lower(email))`,
  // Sub-admins: people who only register donors (in the "Omo Beeza Sub-admin"
  // app), each with a number of donors to register. They have no dashboard
  // access; they sign in with their phone number and a password an admin set.
  `create table if not exists registrars (
    id serial primary key,
    name text not null,
    phone text not null unique,
    password_hash text not null,
    target int not null default 0,
    status text not null default 'active',
    created_by int references users(id) on delete set null,
    created_at timestamptz not null default now(),
    last_login timestamptz
  )`,
  `create table if not exists registrar_sessions (
    id text primary key,
    registrar_id int not null references registrars(id) on delete cascade,
    expires_at timestamptz not null,
    created_at timestamptz not null default now()
  )`,
  `alter table donors add column if not exists registered_by int references registrars(id) on delete set null`,
  `create index if not exists donors_registered_by on donors (registered_by)`,
  `create index if not exists donor_payments_donor on donor_payments (donor_id, paid_on desc)`,
  `create index if not exists sms_log_created on sms_log (created_at desc)`,
  `create index if not exists submissions_created on submissions (created_at desc)`,
  `create index if not exists chat_logs_created on chat_logs (created_at desc)`,
];
