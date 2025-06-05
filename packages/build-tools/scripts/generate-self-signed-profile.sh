#!/usr/bin/env bash
#
# Generates:
#  1. A self-signed “iPhone Developer”-style .p12 certificate (valid ~10 years)
#  2. A minimal “fake” provisioning profile (.mobileprovision) signed using `security cms`
#
# This version creates a temporary keychain, adds it to the search list, trusts the self-signed cert there,
# uses `security cms -S -k` to sign the provisioning-profile plist, then cleans up.
# After execution, it prints additional info:
#  • Base64-encoded .p12
#  • Base64-encoded .mobileprovision
#  • serialNumber from the .p12
#  • fingerprint (SHA1) from the .p12
#  • common name from the .p12
#
# Requirements:
#  • openssl (with x509 + pkcs12 support)
#  • uuidgen
#  • macOS `security` CLI
#
# Usage:
#  chmod +x generate_fake_ios_cert_and_profile.sh
#  ./generate_fake_ios_cert_and_profile.sh
#
# Output is written into a subdir named “output” in the current folder.

set -euo pipefail

# 1) Prepare output directory
OUTPUT_DIR="./output"
mkdir -p "$OUTPUT_DIR"

# File paths (relative initially)
CONFIG_PATH="$OUTPUT_DIR/codesign.cnf"
KEY_PATH="$OUTPUT_DIR/DevCert.key"
CERT_PEM_PATH="$OUTPUT_DIR/DevCert.pem"
CERT_PASSWORD="testpass"
P12_PATH="$OUTPUT_DIR/DevCert.p12"
PLIST_PATH="$OUTPUT_DIR/Dummy.plist"
PROFILE_PATH="$OUTPUT_DIR/Dummy.mobileprovision"

TEMP_KEYCHAIN_NAME="temp-ios-sign.keychain-db"

###############################################################################
# 2) Write an OpenSSL config that ensures Code Signing EKU is included
cat > "$CONFIG_PATH" << 'EOF'
[ req ]
default_bits       = 2048
default_md         = sha256
prompt             = no
distinguished_name = dn
req_extensions     = req_ext

[ dn ]
C  = US
ST = California
L  = Palo Alto
O  = Expo
OU = SELFSIGNED
CN = iPhone Developer: Self Signed (SELFSIGNED)

[ req_ext ]
basicConstraints = CA:FALSE
keyUsage         = digitalSignature, keyEncipherment

[ x509_ext ]
basicConstraints   = critical, CA:FALSE
keyUsage           = critical, digitalSignature, keyEncipherment
extendedKeyUsage   = critical, codeSigning
EOF

echo "✅ OpenSSL config written to $CONFIG_PATH"

###############################################################################
# 3) Generate a self-signed “iPhone Developer”-style certificate + private key
#    - 2048-bit RSA, valid for 3650 days (~10 years)
echo "🔐 Generating private key and self-signed certificate…"
openssl req -x509 \
  -newkey rsa:2048 \
  -keyout "$KEY_PATH" \
  -out "$CERT_PEM_PATH" \
  -days 3650 \
  -nodes \
  -config "$CONFIG_PATH" \
  -extensions x509_ext

echo "✅ Generated key at $KEY_PATH and cert at $CERT_PEM_PATH"

###############################################################################
# 4) Package the PEM key + cert into a .p12 (with password)
echo "📦 Packing DevCert.key + DevCert.pem into .p12…"
openssl pkcs12 -export \
  -legacy \
  -inkey "$KEY_PATH" \
  -in "$CERT_PEM_PATH" \
  -out "$P12_PATH" \
  -name "iPhone Developer: Self Signed (SELFSIGNED)" \
  -passout "pass:$CERT_PASSWORD"

echo "✅ Created .p12 at $P12_PATH"

###############################################################################
# 5) Capture only the basename “login.keychain-db” from the current search list
echo "🔍 Capturing only 'login.keychain-db' from keychain search list…"
ORIG_LOGIN_KEYCHAIN=$(security list-keychains -d user | tr -d ' "' | sed "s|${HOME}/Library/Keychains/||")
echo "   → Found: $ORIG_LOGIN_KEYCHAIN"

###############################################################################
# 6) Create a temporary keychain and add it to the search list
echo "🔑 Creating temporary keychain at $TEMP_KEYCHAIN_NAME"
security create-keychain -p "" "$TEMP_KEYCHAIN_NAME"
# Ensure it’s unlocked for at least an hour
security set-keychain-settings -t 3600 -l "$TEMP_KEYCHAIN_NAME"

echo "➕ Adding temporary keychain to search list…"
security list-keychains -d user -s "$TEMP_KEYCHAIN_NAME" $ORIG_LOGIN_KEYCHAIN

###############################################################################
# 7) Import the .p12 into the temp keychain and trust its cert
echo "🔐 Importing .p12 into temporary keychain…"
security import "$P12_PATH" \
  -k "$TEMP_KEYCHAIN_NAME" \
  -P "$CERT_PASSWORD" \
  -T /usr/bin/codesign \
  -T /usr/bin/security

echo "🔏 Trusting the certificate in temporary keychain…"
echo "We may ask password when executing the following command:"
set -x
security add-trusted-cert \
  -d \
  -r trustRoot \
  -k "$TEMP_KEYCHAIN_NAME" \
  "$CERT_PEM_PATH"
set +x

echo "✅ Temporary keychain ready (cert is trusted there)"

###############################################################################
# 8) Extract DER-encoded certificate as Base64 for plist embedding
echo "📝 Extracting DER/Base64 of the certificate…"
DER_BASE64=$(openssl x509 -in "$CERT_PEM_PATH" -outform der | base64 -b 0)

###############################################################################
# 9) Generate a UUID for the provisioning profile
echo "🔢 Generating UUID for provisioning profile…"
UUID=$(uuidgen)
echo "   → UUID: $UUID"

###############################################################################
# 10) Write a minimal provisioning-profile plist
CREATION_DATE="2025-06-05T00:00:00Z"
EXPIRATION_DATE="2035-06-05T00:00:00Z"
cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" \
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Name</key>
  <string>dummy: test profile</string>

  <key>UUID</key>
  <string>${UUID}</string>

  <key>Version</key>
  <integer>1</integer>

  <key>CreationDate</key>
  <date>${CREATION_DATE}</date>
  <key>ExpirationDate</key>
  <date>${EXPIRATION_DATE}</date>
  <key>TimeToLive</key>
  <integer>3652</integer>

  <key>AppIDName</key>
  <string>dummy: any app</string>

  <key>ApplicationIdentifierPrefix</key>
  <array>
    <string>SELFSIGNED</string>
  </array>
  <key>ApplicationIdentifier</key>
  <string>SELFSIGNED.com.example.myapp</string>

  <key>Platform</key>
  <array>
    <string>iOS</string>
  </array>

  <key>DeveloperCertificates</key>
  <array>
    <data>
${DER_BASE64}
    </data>
  </array>

  <key>Entitlements</key>
  <dict>
    <key>application-identifier</key>
    <string>SELFSIGNED.com.example.myapp</string>
    <key>get-task-allow</key>
    <true/>
    <key>keychain-access-groups</key>
    <array>
      <string>SELFSIGNED.*</string>
    </array>
    <key>com.apple.developer.team-identifier</key>
    <string>SELFSIGNED</string>
    <key>aps-environment</key>
    <string>production</string>
  </dict>

  <key>ProvisionedDevices</key>
  <array/>

  <key>TeamIdentifier</key>
  <array>
    <string>SELFSIGNED</string>
  </array>
  <key>TeamName</key>
  <string>Selfsigners United</string>
</dict>
</plist>
EOF

echo "✅ Plist written to $PLIST_PATH"

###############################################################################
# 11) Use `security cms -S` to sign the plist into a .mobileprovision
echo "🔏 Signing plist into .mobileprovision using security cms…"
security cms -S \
  -k "$TEMP_KEYCHAIN_NAME" \
  -N "iPhone Developer: Self Signed (SELFSIGNED)" \
  -i "$PLIST_PATH" \
  -o "$PROFILE_PATH"

echo "✅ Created fake provisioning profile at $PROFILE_PATH"

###############################################################################
# 12) Print additional information

echo
echo "--------------------------------------"
echo "📝 Additional Information:"
echo

echo "Base64-encoded .p12:"
openssl base64 -in "$P12_PATH"
echo

echo "Base64-encoded .mobileprovision:"
openssl base64 -in "$PROFILE_PATH"
echo

echo "serialNumber from .p12:"
openssl pkcs12 -legacy -in "$P12_PATH" -nokeys -passin "pass:$CERT_PASSWORD" -clcerts \
  | openssl x509 -noout -serial
echo

echo "fingerprint (SHA1) from .p12:"
openssl pkcs12 -legacy -in "$P12_PATH" -nokeys -passin "pass:$CERT_PASSWORD" -clcerts \
  | openssl x509 -noout -fingerprint -sha1 | sed 's/://g'
echo

echo "common name from .p12:"
openssl pkcs12 -legacy -in "$P12_PATH" -nokeys -passin "pass:$CERT_PASSWORD" -clcerts \
  | openssl x509 -noout -subject \
  | sed -n 's/^.*CN=\([^,]*\).*$/\1/p'
echo "--------------------------------------"
echo

###############################################################################
# 13) Restore the original keychain search list
echo "♻️ Restoring original keychain search list…"
security list-keychains -d user -s "$HOME/Library/Keychains/$ORIG_LOGIN_KEYCHAIN"

###############################################################################
# 14) Cleanup: delete the temporary keychain
echo "🧹 Deleting temporary keychain…"
security delete-keychain "$TEMP_KEYCHAIN_NAME"

###############################################################################
# 15) Final message
echo
echo "--------------------------------------"
echo "All done! Generated files in: $OUTPUT_DIR"
echo " • Self-signed certificate (.p12):     $P12_PATH"
echo " • Fake provisioning profile:           $PROFILE_PATH"
echo "--------------------------------------"
