-- Enquiry + pageview events. Cookieless, no IP, no personal data:
-- only what kind of click, which market button, which page, and the
-- visitor's country as Cloudflare reports it.
CREATE TABLE IF NOT EXISTS events (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  ts      INTEGER NOT NULL,            -- unix seconds
  type    TEXT    NOT NULL,            -- view | whatsapp | call | email | form
  market  TEXT    NOT NULL DEFAULT '', -- india | uae | thailand | '' (not chosen)
  path    TEXT    NOT NULL DEFAULT '',
  ref     TEXT    NOT NULL DEFAULT '', -- referrer host only (google.com, chatgpt.com …)
  country TEXT    NOT NULL DEFAULT ''  -- ISO-2 from Cloudflare
);
CREATE INDEX IF NOT EXISTS events_ts   ON events(ts);
CREATE INDEX IF NOT EXISTS events_type ON events(type, ts);
