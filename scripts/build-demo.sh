#!/usr/bin/env bash
# Clickable preview build with sample data (src/demo.ts). Static files only, relative paths, hash routes.
# Never deploy this as the real site: it has no backend and refuses payments by design.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist-demo
npx vite build --mode demo --base ./ --outDir dist-demo
mkdir -p dist-demo/demo && cp public-demo/* dist-demo/demo/
# Public files are referenced with absolute paths in code; make them relative so the build works from any folder.
for f in dist-demo/assets/*.js; do sed -i -E 's#(["'"'"'`])/(brand|press|email-assets|favicon)#\1./\2#g' "$f"; done
for f in dist-demo/assets/*.css; do sed -i -E 's#url\((["'"'"']?)/brand/#url(\1../brand/#g' "$f"; done
sed -i -E 's#(href|src)="/(brand|favicon)#\1="./\2#g' dist-demo/index.html
rm -rf dist-demo/email-assets
# Page body for a hosted preview page that supplies its own <html>/<head> skeleton.
python3 - <<'PY'
import re
s = open('dist-demo/index.html').read()
head = re.search(r'<head>(.*)</head>', s, re.S).group(1)
body = re.search(r'<body>(.*)</body>', s, re.S).group(1)
head = re.sub(r'<meta charset[^>]*>\s*|<meta name="viewport"[^>]*>\s*', '', head)
head = head.replace('<title>Doorstep</title>', '<title>Doorstep App Preview</title>')
open('dist-demo/preview.html', 'w').write(head.strip() + '\n' + body.strip() + '\n')
PY
echo "Preview build in dist-demo/"
