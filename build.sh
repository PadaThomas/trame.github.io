#!/bin/sh
# TRAME — assemble index.html + css + js en un seul fichier autonome : dist/TRAME.html
cd "$(dirname "$0")"
mkdir -p dist
OUT=dist/TRAME.html
{
  sed -n '1,/<link rel="stylesheet"/p' index.html | sed '$d'
  echo '<style>'
  # polices de la charte intégrées (base64) : fonctionne hors ligne
  for spec in "Inter|inter|100 900" "Space Grotesk|space-grotesk|300 700" "JetBrains Mono|jetbrains-mono|100 800"; do
    fam=${spec%%|*}; rest=${spec#*|}; file=${rest%%|*}; w=${rest#*|}
    printf "@font-face{font-family:'%s';src:url(data:font/woff2;base64,%s) format('woff2');font-weight:%s;font-style:normal;font-display:swap}\n" "$fam" "$(base64 < fonts/$file-latin-wght-normal.woff2 | tr -d '\n')" "$w"
  done
  cat css/trame-tokens.css css/style.css
  echo '</style>'
  sed -n '/<\/head>/,/<script src="js\/library.js">/p' index.html | sed '$d'
  echo '<script>'; cat js/library.js; echo '</script>'
  echo '<script>'; cat js/ai-import.js 2>/dev/null; echo '</script>'
  echo '<script>'; cat js/app.js; echo '</script>'
  echo '</body></html>'
} > "$OUT"
# ancienne adresse conservée le temps de la transition (même contenu)
cp "$OUT" dist/Synoptique.html
# version en ligne (GitHub Pages) : dossier docs/ = application + manifeste + icônes + service worker
rm -rf docs && mkdir -p docs/icons
cp "$OUT" docs/index.html
cp pwa/manifest.webmanifest docs/
cp pwa/icons/* docs/icons/
sed "s/__VERSION__/$(date +%Y%m%d%H%M%S)/" pwa/sw.js > docs/sw.js
touch docs/.nojekyll
echo "OK -> $OUT + docs/ (GitHub Pages)"
