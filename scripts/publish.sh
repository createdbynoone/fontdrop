#!/bin/bash
# Single-pass publish: builds once, computes correct sha512, uploads sequentially.
# This prevents the race condition where two parallel electron-builder publish
# processes sign the app at different times → different ZIPs → sha512 mismatch.

set -euo pipefail

VERSION=$(node -p "require('./package.json').version")
echo "==> Building v$VERSION"

npx electron-vite build
npx electron-builder --config electron-builder.yml --publish never

ZIP="dist/FontDrop-${VERSION}-arm64-mac.zip"
DMG="dist/FontDrop-${VERSION}-arm64.dmg"

echo "==> Computing correct sha512s"
ZIP_SHA=$(shasum -a 512 "$ZIP" | awk '{print $1}' | xxd -r -p | base64)
ZIP_SIZE=$(stat -f%z "$ZIP")
DMG_SHA=$(shasum -a 512 "$DMG" | awk '{print $1}' | xxd -r -p | base64)
DMG_SIZE=$(stat -f%z "$DMG")
DATE=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

cat > dist/latest-mac.yml << YML
version: $VERSION
files:
  - url: FontDrop-${VERSION}-universal-mac.zip
    sha512: ${ZIP_SHA}
    size: ${ZIP_SIZE}
  - url: FontDrop-${VERSION}-universal.dmg
    sha512: ${DMG_SHA}
    size: ${DMG_SIZE}
path: FontDrop-${VERSION}-universal-mac.zip
sha512: ${ZIP_SHA}
releaseDate: '${DATE}'
YML

echo "==> Creating GitHub release v$VERSION"
GH_TOKEN=$(gh auth token)
RELEASE_ID=$(gh api --method POST repos/createdbynoone/fontdrop/releases \
  -f tag_name="v$VERSION" \
  -f name="v$VERSION" \
  -F draft=false \
  -F prerelease=false \
  --jq '.id')
echo "Release ID: $RELEASE_ID"

echo "==> Uploading ZIP (~$(du -sh "$ZIP" | cut -f1))"
curl -s --data-binary "@$ZIP" \
  -H "Content-Type: application/zip" \
  -H "Authorization: Bearer $GH_TOKEN" \
  "https://uploads.github.com/repos/createdbynoone/fontdrop/releases/${RELEASE_ID}/assets?name=$(basename "$ZIP")" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('  zip:', d.get('name'), d.get('size','ERR'), d.get('message',''))"

echo "==> Uploading ZIP blockmap"
curl -s --data-binary "@${ZIP}.blockmap" \
  -H "Content-Type: application/octet-stream" \
  -H "Authorization: Bearer $GH_TOKEN" \
  "https://uploads.github.com/repos/createdbynoone/fontdrop/releases/${RELEASE_ID}/assets?name=$(basename "${ZIP}.blockmap")" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('  blockmap:', d.get('name'), d.get('size','ERR'))"

echo "==> Uploading latest-mac.yml"
curl -s --data-binary @dist/latest-mac.yml \
  -H "Content-Type: application/octet-stream" \
  -H "Authorization: Bearer $GH_TOKEN" \
  "https://uploads.github.com/repos/createdbynoone/fontdrop/releases/${RELEASE_ID}/assets?name=latest-mac.yml" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('  yml:', d.get('name'), d.get('size','ERR'))"

echo "==> Marking as latest"
gh api --method PATCH "repos/createdbynoone/fontdrop/releases/$RELEASE_ID" -f make_latest=true --jq '.tag_name'

echo "==> Done! v$VERSION published."
