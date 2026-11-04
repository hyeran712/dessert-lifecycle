#!/usr/bin/env bash
# src/ 의 네 파일을 합쳐 index.html 을 만든다. (index.html 은 직접 고치지 말 것)
set -euo pipefail
cd "$(dirname "$0")/src"
{ cat head.html body.html
  printf '<script type="application/json" id="data">'; cat data.json
  printf '</script>\n<script>\n'; cat app.js
  printf '</script>\n</body>\n</html>\n'; } > ../index.html
echo "index.html 만들기 완료"
