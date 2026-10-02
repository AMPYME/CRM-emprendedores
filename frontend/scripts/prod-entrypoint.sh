#!/bin/sh
# Reescribe URLs horneadas con las del entorno Docker / .env de runtime.
# Además limpia cualquier resto de *.ampyme.local.
set -eu

cd /app

# Valores horneados en build (desde frontend/.env)
if [ -f .bake-env ]; then
  # shellcheck disable=SC1091
  set -a
  . ./.bake-env
  set +a
fi

BAKE_API="${BAKE_NEXT_PUBLIC_API_URL:-http://10.14.80.245/api/v1}"
BAKE_WS="${BAKE_NEXT_PUBLIC_WS_URL:-ws://10.14.80.245/ws/intake}"
BAKE_FORM="${BAKE_NEXT_PUBLIC_INTAKE_FORM_URL:-}"

API_URL="${NEXT_PUBLIC_API_URL:-$BAKE_API}"
WS_URL="${NEXT_PUBLIC_WS_URL:-$BAKE_WS}"
FORM_URL="${NEXT_PUBLIC_INTAKE_FORM_URL-}"

escape_sed() {
  printf '%s' "$1" | sed -e 's/[.\\/&*|[\]]/\\&/g'
}

replace_in_tree() {
  old="$1"
  new="$2"
  if [ -z "$old" ] || [ "$old" = "$new" ]; then
    return 0
  fi
  old_esc="$(escape_sed "$old")"
  new_esc="$(escape_sed "$new")"
  find . -type f \( -name '*.js' -o -name '*.json' -o -name '*.html' -o -name '*.rsc' \) 2>/dev/null \
    | while IFS= read -r file; do
        if grep -F -q -- "$old" "$file" 2>/dev/null; then
          sed -i "s|${old_esc}|${new_esc}|g" "$file"
        fi
      done
}

echo "[entrypoint] Runtime API=${API_URL}"
echo "[entrypoint] Runtime WS=${WS_URL}"
echo "[entrypoint] Runtime INTAKE_FORM=${FORM_URL:-<empty>}"

replace_in_tree "$BAKE_API" "$API_URL"
replace_in_tree "$BAKE_WS" "$WS_URL"

case "$BAKE_API" in
  https://*) replace_in_tree "http://${BAKE_API#https://}" "$API_URL" ;;
  http://*)  replace_in_tree "https://${BAKE_API#http://}" "$API_URL" ;;
esac
case "$BAKE_WS" in
  wss://*) replace_in_tree "ws://${BAKE_WS#wss://}" "$WS_URL" ;;
  ws://*)  replace_in_tree "wss://${BAKE_WS#ws://}" "$WS_URL" ;;
esac

# Limpieza de dominios .local (este entorno no los resuelve)
replace_in_tree "https://api-emprendedores.ampyme.local/api/v1" "$API_URL"
replace_in_tree "http://api-emprendedores.ampyme.local/api/v1" "$API_URL"
replace_in_tree "wss://api-emprendedores.ampyme.local/ws/intake" "$WS_URL"
replace_in_tree "ws://api-emprendedores.ampyme.local/ws/intake" "$WS_URL"
replace_in_tree "https://emprendedores.ampyme.local/emprendedores/" "${FORM_URL}"
replace_in_tree "http://emprendedores.ampyme.local/emprendedores/" "${FORM_URL}"

if [ -n "$BAKE_FORM" ]; then
  replace_in_tree "$BAKE_FORM" "$FORM_URL"
fi

exec "$@"
