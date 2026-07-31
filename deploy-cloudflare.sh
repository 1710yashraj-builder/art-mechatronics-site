#!/usr/bin/env bash
# Deploy the built site to Cloudflare Pages.
#
# This never runs a build of its own — it ships exactly what is in dist/client,
# so always regenerate + validate + package first (see the guard below).
#
#   ./deploy-cloudflare.sh            # deploy to a preview URL (safe, default)
#   ./deploy-cloudflare.sh production # deploy to the production branch
#
# Requires a Cloudflare login. Yash must do this once, interactively:
#   npx wrangler login
# Nothing here creates an account or handles a password.

set -euo pipefail
cd "$(dirname "$0")"

PROJECT="art-mechatronics"
DIST="dist/client"
BRANCH="${1:-preview}"

if [ ! -d "$DIST" ]; then
  echo "ERROR: $DIST missing. Run the build first:"
  echo "  node build/generate.js --all && node build/package_static.js"
  exit 1
fi


# --- sample-content gate -------------------------------------------------
# Placeholder testimonials exist so Anurag can review the design in place.
# They must never reach the production branch, which is what becomes
# artmechatronics.com. Preview deploys are allowed; production is refused.
SAMPLES=$(python3 -c "import json;d=json.load(open('build/data/testimonials.json'));print(sum(1 for t in d.get('testimonials',[]) if t.get('sample')))" 2>/dev/null || echo 0)
if [ "$SAMPLES" != "0" ] && [ "$BRANCH" = "production" ]; then
  echo "REFUSED: $SAMPLES placeholder testimonial(s) still in build/data/testimonials.json."
  echo "These are sample copy for client review and cannot go to the production branch."
  echo "Replace them with real quotes (and permission), remove the \"sample\": true flag,"
  echo "then deploy again. To show Anurag now, deploy to preview instead:"
  echo "    ./deploy-cloudflare.sh preview"
  exit 1
fi
if [ "$SAMPLES" != "0" ]; then
  echo "NOTE: $SAMPLES placeholder testimonial(s) included — preview only."
fi

echo "==> Re-running validators before shipping anything"
node build/validate_image_system.js --require-complete
node build/validate_site.js

echo
echo "==> Confirming the bundle is not stale"
newest_src=$(find products industries css js *.html robots.txt llms.txt -type f -newer "$DIST/index.html" 2>/dev/null | head -5 || true)
if [ -n "$newest_src" ]; then
  echo "ERROR: these source files are newer than the bundle — repackage first:"
  echo "$newest_src"
  echo "  node build/generate.js --all && node build/package_static.js"
  exit 1
fi

for f in robots.txt llms.txt sitemap.xml _headers _redirects 404.html; do
  [ -f "$DIST/$f" ] || { echo "ERROR: $DIST/$f is missing from the bundle"; exit 1; }
done
echo "    all deploy-critical files present"

echo
if ! npx wrangler whoami >/dev/null 2>&1; then
  cat <<'MSG'
NOT LOGGED IN to Cloudflare.

Run this once, in your own terminal (it opens a browser for you to approve):
    npx wrangler login

If the Cloudflare account does not exist yet, create it at
https://dash.cloudflare.com/sign-up FIRST — ideally under the CLIENT's
info@artmechatronics.com address, so hosting is client-owned from day one
rather than sitting on a personal account.

Then re-run this script.
MSG
  exit 1
fi

echo "==> Deploying $DIST to Cloudflare Pages project '$PROJECT' (branch: $BRANCH)"
if [ "$BRANCH" = "production" ]; then
  npx wrangler pages deploy "$DIST" --project-name="$PROJECT" --branch=main
else
  npx wrangler pages deploy "$DIST" --project-name="$PROJECT" --branch=preview
fi

echo
echo "Done. Test the *.pages.dev URL it printed BEFORE touching DNS."
echo "Checklist: home, catalogue search, one product page, a garbage URL (branded 404),"
echo "and 'curl -sI <url>' to confirm the security headers are present."
