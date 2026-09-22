"""
Standalone MFA/TOTP smoke test — no frontend, no HTTP, no database.

Run it, scan the printed otpauth:// URI's QR (or add the secret manually),
then type the 6-digit code your authenticator app shows. If this script says
the code is valid but the real app still says "Invalid code", the bug is in
the app's enroll/confirm plumbing (stale secret, session mismatch, ...), not
in TOTP itself or your phone's clock. If this script ALSO rejects a code you
just scanned, the problem is your phone's clock vs this machine's clock —
see the printed time comparison below.

Usage (from backend/):
    uv run python scripts/mfa_debug.py
"""

import sys
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import pyotp  # noqa: E402
import qrcode  # noqa: E402

secret = pyotp.random_base32()
totp = pyotp.TOTP(secret)
uri = totp.provisioning_uri(name="debug@learnia.local", issuer_name="Learnia (debug)")

print(f"Secret (manual entry): {secret}")
print(f"otpauth URI:           {uri}")
print(f"This machine's UTC time right now: {datetime.now(UTC).isoformat(timespec='seconds')}")
print()
print("Scan this QR in your terminal, or open the URI above in an authenticator app:")
qr = qrcode.QRCode()
qr.add_data(uri)
qr.print_ascii(invert=True)

print()
while True:
    code = input("Enter the 6-digit code from your app (blank to quit): ").strip()
    if not code:
        break
    now_expected = totp.now()
    ok = totp.verify(code, valid_window=1)
    print(f"  -> server expects right now: {now_expected}")
    print(f"  -> valid (±30s window):      {ok}")
    if not ok:
        # Show neighboring steps so a constant clock offset is obvious:
        # e.g. if your code matches "one step ahead", your phone's clock
        # (or this machine's) is off by roughly 30-60 seconds.
        for steps in (-2, -1, 1, 2):
            drifted = totp.at(datetime.now(UTC), counter_offset=steps)
            print(f"     (code {steps:+d} step(s) away would be: {drifted})")
    print()
