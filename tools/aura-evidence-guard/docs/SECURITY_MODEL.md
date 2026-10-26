# Security model and trust boundaries

## Integrity, signatures and authority are separate claims

- SHA-256 binds a byte sequence to a digest; by itself it does not identify who produced it.
- A Git blob SHA-1 is reproduced only to bind bytes to an existing SHA-1 Git object identifier; it is not used as a signature or new security digest.
- SSHSIG validates a signature under a supplied public-key/allowed-signers configuration and namespace. It does not prove the allow-list is independent, the key belongs to a named person, or that the signer has legal or constitutional competence.
- The manifest is not self-authenticating. Acquire the manifest and payload through an approved custody channel and verify a detached signature against a separately pinned public key when required.
- A cryptographic PASS cannot promote G0, M1, P-008, implementation authorization, normative effect or release status.

## GitHub integration

The REST client performs GET requests only. It does not expose mutation, merge, dispatch or write methods. API bearer credentials are sent only to `api.github.com`; they must not be forwarded to signed artifact-download redirects. Artifact verification fails closed on absent or mismatching API digest, missing/different run binding, oversized payload, unsafe ZIP paths, symlinks, duplicate names or CRC failure.

The PR workflow is offline-only. The networked audit workflow is separate, manual, read-only and available on `main` after merge. Use a least-privilege token; never commit tokens or private keys.

## Fail-closed behavior

Missing data, mismatched SHA, invalid signatures, unsafe paths, unexpected files, dirty source trees, unknown object source, absent artifact digests and failed checks are surfaced as explicit failures or non-passing states. Do not silently recategorize these results as PASS.

## Governance states preserved at staging

- G0: `OPEN / BLOCKED`
- M1: `EXHAUSTED / NOT RESOLVED`
- P-008: `PROPOSED / BLOCKED`
- C6: `BLOCKED_PENDING_EVIDENCE_REVIEW`
- L0: `PREPARED_NOT_EXECUTED`
- Air Gap: `NOT_PROVEN`
- Authority, governance, authorization and release effects: `NONE`

A signature failure or authority gap must be resolved through the applicable primary evidence and procedure. Code changes are not a substitute.
