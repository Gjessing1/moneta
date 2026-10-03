#!/usr/bin/env bash
# The one command that ships an APK: build the release declared in build.gradle, publish it, then
# ask the live backend for its version, download the APK it serves and compare the SHA-256.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
gradle_file="$root/android/app/build.gradle"
verify_url="${MONETA_ANDROID_VERIFY_URL:-http://127.0.0.1:3047/api/app/version}"

version_code="$(sed -nE 's/^[[:space:]]*versionCode[[:space:]]+([0-9]+)[[:space:]]*$/\1/p' "$gradle_file")"
version_name="$(sed -nE 's/^[[:space:]]*versionName[[:space:]]+"([^"]+)"[[:space:]]*$/\1/p' "$gradle_file")"
if [[ ! "$version_code" =~ ^[1-9][0-9]*$ || -z "$version_name" ]]; then
  echo "Could not read one Android versionCode and versionName from $gradle_file" >&2
  exit 1
fi

"$root/android/build-apk.sh"
apk="$root/android/app/build/outputs/apk/release/app-release.apk"
"$root/scripts/publish-android.sh" "$apk" "$version_code" "$version_name"

response="$(curl --fail --silent --show-error --header 'Cache-Control: no-cache' "$verify_url")"
read -r published_sha apk_url < <(
  node -e '
    const release = JSON.parse(process.argv[1]);
    const expectedCode = Number(process.argv[2]);
    const expectedName = process.argv[3];
    if (release.versionCode !== expectedCode || release.versionName !== expectedName) {
      console.error(`Live API reports ${release.versionName} (${release.versionCode}), expected ${expectedName} (${expectedCode})`);
      process.exit(1);
    }
    if (typeof release.sha256 !== "string" || typeof release.apkUrl !== "string") process.exit(1);
    process.stdout.write(`${release.sha256} ${release.apkUrl}\n`);
  ' "$response" "$version_code" "$version_name"
)

download_url="$(node -e 'process.stdout.write(new URL(process.argv[1], process.argv[2]).href)' "$apk_url" "$verify_url")"
downloaded_apk="$(mktemp --suffix=.apk)"
trap 'rm -f "$downloaded_apk"' EXIT
curl --fail --silent --show-error --location --header 'Cache-Control: no-cache' --output "$downloaded_apk" "$download_url"
downloaded_sha="$(sha256sum "$downloaded_apk" | cut -d ' ' -f 1)"
if [[ "$downloaded_sha" != "$published_sha" ]]; then
  echo "Downloaded APK checksum does not match the live release metadata" >&2
  exit 1
fi

echo "Verified live Android $version_name ($version_code) at $download_url"
