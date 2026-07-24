# Domain migration — chatgpt.site → artmechatronics.com

Prepared 2026-07-24, adversarially reviewed (4-lens verification) same day.
Status: **code prep complete and verified; deploy blocked on two owner decisions** (see Blockers).

## What changed in this prep

| File | Change |
|---|---|
| `site/build/generate.js` | `BRAND.site` → `https://artmechatronics.com` (drives every canonical, og:url, JSON-LD image URL, sitemap) |
| `site/build/package_static.js` | `SITE_ORIGIN` → new domain; packager now also copies `robots.txt`, `_headers`, `_redirects`, `.htaccess` |
| `site/build/validate_site.js` | `LIVE_ORIGIN` → new domain; added a "stale ChatGPT Sites origin" tripwire so the old URL can never silently return |
| Root pages (index, about, contact, machines, system, control-panel) | Hand-maintained canonicals swapped to the new domain |
| `site/js/machine.js` | Runtime canonical for the 3 flagship `machine.html?id=` views → new domain (other ids never had one; `machine.html` itself is now `noindex`, so no thin-duplicate risk) |
| `site/machine.html` | NEW `noindex` meta (legacy client-rendered viewer; the static `products/*.html` pages are the real, indexed surface) |
| `site/robots.txt` | NEW — allow all + sitemap pointer |
| `site/404.html` | NEW — branded not-found page, root-absolute paths (`data-base="/"`), noindex, `?v=` in lockstep with current build |
| `site/_headers` | NEW — Netlify security headers (CSP verified against all 413 pages, zero violations) + cache rules. HSTS starts at 1 day (ramp: step 10) |
| `site/_redirects` | NEW — www→apex 301s (host-scoped, loop-free) |
| `site/.htaccess` | NEW — same policy for the GoDaddy/Apache route (ignored on Netlify) |

All 403 generated pages + sitemap regenerated; both validators PASS (exit 0); `dist/client/` repackaged (byte-identical to source, 413 files). Old origin: **zero references anywhere** in source or deploy bundle. `.openai/hosting.json` untouched per project rules.

## Blockers (owner decisions, in order)

1. **Phone number** — site-wide CTA number `+91 81918 48660` matches no client document (client's v2 spec: `+91-8090315151` India / `+971-502167151` UAE). Waiting on Anurag. **Do not launch before this is resolved** — every lead flows to this number. Swap procedure: § "Phone swap" below.
2. **Hosting choice** — **Recommended: Netlify** (deploy folder = `site/dist/client/`; `_headers`/`_redirects` ready). Alternative: GoDaddy hosting already on the domain (`.htaccess` ready).

## STEP 0 — before touching anything (mandatory)

1. GoDaddy → DNS management for artmechatronics.com → **screenshot/export EVERY record** (A, CNAME, MX, TXT, NS, their values AND TTLs) and paste the picture/table into this file under "DNS zone as of &lt;date&gt;". This is the rollback baseline; without it nothing can be restored. Known today: apex A = `132.148.180.151` (GoDaddy hosting, empty page); MX = secureserver.net (⚠️ **the client's business email — info@/careers@ — lives on these MX records**).
2. Check whether "Domain Forwarding" is configured on the domain — if yes, note it and plan to remove it at cutover (it conflicts with the new site).
3. Note if DNSSEC is enabled (GoDaddy domain settings). If it is, be extra careful: a wrong edit can make the whole domain unresolvable.
4. `git -C site commit` the prep and tag it (e.g. `launch-2026-07`) so there is a code rollback point independent of DNS/Netlify.

## Day before cutover

- Lower TTL to **600 seconds** on the apex A record and the www CNAME (only these two). This makes cutover *and rollback* take minutes instead of an hour.

## Go-live steps (Netlify path)

1. Resolve blocker 1 → regenerate → both validators → repackage (§ Phone swap).
2. Netlify: new site → deploy `site/dist/client/` (drag-and-drop or CLI).
3. Verify on the `*.netlify.app` URL first: home, catalogue search, one product page, system page, a garbage URL (branded 404 must appear), `curl -sI` shows the security headers.
4. Netlify → Domain settings → add **both** `artmechatronics.com` and `www.artmechatronics.com` (the www alias is required — without it the www redirect rules never fire and the certificate won't cover www).
   - ⚠️ **THE ONE CLICK THAT KILLS CLIENT EMAIL**: Netlify will push "Set up Netlify DNS" as the recommended option and walk you into changing nameservers at GoDaddy. **Do NOT choose it.** Pick the manual/external-DNS path. Never approve any screen that mentions changing nameservers — that silently drops the MX records and the client's email dies.
5. DNS at GoDaddy — **edit records only, never nameservers**:
   - Apex `A` record: **CHANGE the existing record's value** from `132.148.180.151` to the IP Netlify shows in its domain instructions (don't copy an IP from old guides). Do not ADD a second A record — after saving, confirm exactly ONE apex A record exists (two = visitors randomly hit the empty old page and the SSL certificate gets stuck).
   - `www` `CNAME` → `<site-name>.netlify.app` (change existing www record if there is one).
   - Remove Domain Forwarding if step 0 found any.
   - **Touch nothing else.** MX + TXT (SPF/DKIM) stay exactly as they are.
6. Wait for both hostnames to show green in Netlify Domain settings, then for the Let's Encrypt certificate. Normally minutes (fast because of the 600s TTL). Seeing a certificate warning on https:// during this window is normal — it disappears when the real cert is issued. **If stuck > 1 hour, check in order:** (a) two apex A records still present, (b) a CAA record in the GoDaddy zone that doesn't allow `letsencrypt.org`, (c) a typo'd www CNAME (a broken www delays the apex cert too — one cert covers both), (d) DNSSEC misconfiguration.
7. Post-launch verification: apex loads over https; `www` and `http` 301 to apex; `curl -sI https://artmechatronics.com` shows all headers (securityheaders.com grade); `robots.txt` + `sitemap.xml` reachable; Lighthouse spot-check; **send AND receive a test email with info@artmechatronics.com** (proves MX survived).
8. Search/AI visibility (the AEO/GEO package): Google Search Console — domain property (verification adds one TXT record at GoDaddy: add-only, mail-safe) → submit sitemap. Bing Webmaster Tools the same (Bing feeds ChatGPT/Copilot answers). Expectation for the client: a brand-new domain takes **days to weeks** to appear in Google/AI answers — do not judge the AEO package in week one.
9. ChatGPT Sites preview: it still serves the **old pre-migration build** (old canonicals, unconfirmed phone). After launch, stop sharing that link anywhere; keep it owner-only. It is not a competitor to the real domain as long as it stays private.
10. **HSTS ramp** (1–2 weeks after a stable launch): in `site/_headers` and `site/.htaccess`, raise `max-age=86400` → `max-age=31536000`, then regenerate-package-redeploy. (We deliberately launch at 1 day so an emergency DNS rollback can't strand visitors on browser errors for a year.)

## Post-launch change rule (give this to whoever edits the site)

Any change — content, CSS, JS, the phone number — goes through: `node build/generate.js --all` → both validators → `node build/package_static.js` → **redeploy the whole `dist/client/` folder**. Never hand-edit or upload a single file. Reason: css/js are cached up to 7 days and only the `?v=` version strings in the regenerated HTML bust that cache.

## Phone swap (when Anurag replies)

1. Update `phoneDisplay`/`phoneDial` in **both** `site/js/data.js` and the BRAND block of `site/build/generate.js` (generate.js also stamps a new `?v=` into every generated page, which busts the cached data.js).
2. If root pages' `?v=` strings for `data.js` are older than the new one, bump them to match (index/about/contact/machines/system/control-panel/404).
3. `generate --all` → both validators → `package_static` → redeploy. If this happens **after** launch, the redeploy is mandatory the same day — repeat visitors otherwise keep the old cached number up to 7 days.

## Rollback ladder (in order — top first)

1. **Bad deploy / broken page** → Netlify → Deploys → previous deploy → "Publish deploy". Instant, no DNS involved. This fixes 95% of launch problems.
2. **Netlify itself unreachable/broken** → GoDaddy DNS: restore the exact records recorded in STEP 0. Takes up to the record TTL to propagate (600s if the day-before step was done; up to 1 hour otherwise). Understand what this does: the old A record serves an **empty page** — DNS rollback makes the site vanish, it does not bring back a working site. It is a last resort, not plan A.
3. After ANY rollback: send + receive a test email on info@ (verify MX intact), and note HSTS: visitors from the last 24h will refuse plain-http — whatever the rollback target is, it must answer on https with a valid certificate.

## GoDaddy-hosting path (only if Netlify is rejected)

Upload `dist/client/*` (including hidden `.htaccess`) to the web root via cPanel/FTP. The `.htaccess` handles https/www redirects, 404, headers, caching. Two cautions from review: if the account sits behind an SSL-terminating proxy, the https redirect can loop (switch the condition to `%{HTTP:X-Forwarded-Proto}`), and `<IfModule>` guards fail silently — `curl -sI` after upload to confirm headers actually appear.

## Known cosmetic backlog (not launch-blocking)

- Root pages carry older `?v=` strings than generated pages (works fine; unify on the next content pass).
- Root pages have no og:url/og:image; product pages lack twitter:image (falls back to og:image). Social-preview polish, post-launch.
- Netlify may not attach custom headers to 404 responses (known platform behavior; page still renders and needs nothing the CSP forbids).
