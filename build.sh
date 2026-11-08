#!/usr/bin/env bash
# Assembles index.html from src/ and data/. Run: ./build.sh
set -euo pipefail
cd "$(dirname "$0")"
{
  cat src/head.html src/body.html
  printf '<script type="application/json" id="whoop">'; cat data/whoop.json; printf '</script>\n'
  printf '<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js"></script>\n'
  printf '<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>\n'
  printf '<script>\n'; cat src/app.js; printf '</script>\n'
} > index.html
echo "Built index.html"
