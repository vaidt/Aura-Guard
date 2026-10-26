# AURA Evidence Guard — non-normative tooling

Package version: 1.0.0. Repository role: operational evidence-integrity and read-only GitHub audit tooling only.

## Scope
This package supplies SHA-256 and Git blob identifiers, strict file manifests, OpenSSH SSHSIG verification/signing for the `aura-evidence` namespace only, preservation ZIP verification, offline Git source-lock checks, a GET-only GitHub REST audit client, and C6 bundle integrity checks.

The GitHub REST client has no remote write methods. Pull-request CI does not invoke it or require network access. A separate manual workflow from `main` is intended for networked read-only auditing only after an independent review and merge.

## Local validation
Run from this directory:

```bash
python -m compileall -q aura_evidence_guard tests
python -m unittest discover -s tests -v
python -m aura_evidence_guard --help
```

OpenSSH `ssh-keygen` is required for SSHSIG operations. Cryptographic verification against a supplied allow-list does not establish the allow-list's independent trust, a human identity, constitutional competence, authority continuity, ratification, or release approval.

## Observed C6 artifact
The earlier audit observed artifact `12602244211` from run `40203268967` in `vaidt/aura-specification`, with SHA-256 `04ade64adcdee1b8d9e4ad761acf37d844bd6c88d8045bdda923aee40859a15c`. Its source SHA was `6d7511c52dae79a58b80dfbabe594141abbb980d`, while PR #49's observed head was `14fddc76298deb3bcb9968525c021f729de63678`. These SHAs differ. The earlier successful run is not evidence for PR #49's then-current head. The larger preservation ZIPs remain in the separately delivered release package, not this source tree.

The C6 content remains `CONTRACT_UNRESOLVED`; `expected_outcomes_assigned=false`; conformance remains `NOT_ESTABLISHED`. Integrity PASS is not a protocol conformance verdict.

## Governance boundary
This package is not an authority-bearing component. The recorded statuses remain G0 `OPEN / BLOCKED`, M1 `EXHAUSTED / NOT RESOLVED`, P-008 `PROPOSED / BLOCKED`, C6 `BLOCKED_PENDING_EVIDENCE_REVIEW`, L0 `PREPARED_NOT_EXECUTED`, Air Gap `NOT_PROVEN`. Authority, governance, authorization and release effects are `NONE`. CI must never re-sign a governance record or weaken a check to force PASS.

### Verification fixes

`sign-evidence` does not accept `--passphrase-env`: noninteractive passphrase
signing is unsupported; use an unlocked key or an SSH agent. Passphrases are never
read by the CLI. Auditing a run requires a PR number and compares its current head
with the run revision, rejects missing source SHAs, and rechecks the PR after the
audit. Historical run 40203268967 remains mismatched, not relabelled as passing.
