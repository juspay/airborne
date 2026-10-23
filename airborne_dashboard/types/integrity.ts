// Signing Key Types - release-config signing (Settings -> Integrity)

export type SigningKey = {
  /** Immutable ID used in `X-Signing-Key-Id` and returned in the signature header. */
  key_id: string;
  /** e.g. "ecdsa-p256" */
  algorithm: string;
  /** SPKI PEM, multi-line. The private key is never returned by the API. */
  public_key: string;
  is_default: boolean;
  disabled: boolean;
  created_at: string;
};

export type SigningKeysResponse = {
  data: SigningKey[];
};

// API Request Types
export type CreateSigningKeyRequest = {
  key_id: string;
};

export type UpdateSigningKeyRequest = {
  disabled: boolean;
};
