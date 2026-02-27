#!/usr/bin/env python3

import base64
import json
import os
import sys

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: aes_gcm_encrypt.py <master_key_hex>", file=sys.stderr)
        return 1

    try:
        master_key = bytes.fromhex(sys.argv[1])
    except ValueError as exc:
        print(f"invalid master key hex: {exc}", file=sys.stderr)
        return 1

    if len(master_key) not in (16, 24, 32):
        print(
            f"invalid master key length: expected 16, 24, or 32 bytes, got {len(master_key)}",
            file=sys.stderr,
        )
        return 1

    plaintext = sys.stdin.buffer.read()
    nonce = os.urandom(12)
    ciphertext = AESGCM(master_key).encrypt(nonce, plaintext, None)

    payload = {
        "nonce": base64.b64encode(nonce).decode("ascii"),
        "ciphertext": base64.b64encode(ciphertext).decode("ascii"),
    }
    print(json.dumps(payload, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
