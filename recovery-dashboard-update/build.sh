#!/usr/bin/env bash
# Assembles index.html from src/ and data/. Run: ./build.sh
# The page works in two places: inside Claude (saves through Claude) and on Vercel
# (saves to Supabase with Google sign-in, configured in config.js).
set -euo pipefail
cd "$(dirname "$0")"
{
  cat src/head.html src/body.html
  printf '<script type="application/json" id="whoop">'; cat data/whoop.json; printf '</script>\n'
  printf '<script src="config.js"></script>\n'
  printf '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>\n'
  printf '<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js"></script>\n'
  printf '<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>\n'
  printf '<script>\n'; cat src/app.js; printf '</script>\n'
} > index.html.tmp
# head.html starts mid-document (artifact style); give the standalone page a full shell
{ printf '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<style>[hidden]{display:none!important}body{margin:0}</style>\n</head>\n<body>\n'; cat index.html.tmp; printf '</body>\n</html>\n'; } > index.html
rm index.html.tmp
echo "Built index.html"
