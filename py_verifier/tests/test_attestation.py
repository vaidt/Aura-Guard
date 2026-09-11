"""INV-ATT-01 — Attestation signature tests (Python side + Node parity).

Validates:
  1. Positive: sign via Node CLI (aura-sign.mjs) → verify via Python.
  2. Negatives: payload_mismatch, bad_signature, unknown_key, revoked_key,
     out_of_window, malformed_attestation.
  3. Pure-Python Ed25519 verifier is bit-for-bit compatible with Node's
     built-in Ed25519 verifier.
"""
import json, os, pathlib, shutil, subprocess, sys
import pytest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from aura_verify import run_suite, validate_bundle, verify_attestation, load_signing_keys  # noqa: E402
from ed25519_ref import verify as ed_verify  # noqa: E402

REPO = pathlib.Path("/app")
NODE_CLI_VERIFY = REPO / "cli" / "aura-verify.mjs"
NODE_CLI_SIGN = REPO / "cli" / "aura-sign.mjs"

MK_BUNDLE = """
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto;
import { writeFileSync } from "node:fs";
const { buildHashChain } = await import("/app/frontend/src/lib/verification.js");
const { buildEvidenceBundle } = await import("/app/frontend/src/lib/exportBundle.js");
const { SAMPLE_SESSION } = await import("/app/frontend/src/lib/sampleData.js");
const chained = await buildHashChain(SAMPLE_SESSION.decisions);
const {decisions: _, ...meta} = SAMPLE_SESSION;
writeFileSync(process.argv[2], JSON.stringify(
  buildEvidenceBundle({rawSession: meta, decisions: chained, importedHadEvidence: false, generatedAt: "2026-02-02T00:00:00Z"}),
  null, 2));
"""


@pytest.fixture(scope="session")
def signed_bundle_path(tmp_path_factory):
    d = tmp_path_factory.mktemp("att")
    p = d / "signed.json"
    mk = d / "mk.mjs"; mk.write_text(MK_BUNDLE)
    subprocess.run(["node", str(mk), str(p)], check=True)
    subprocess.run(
        ["node", str(NODE_CLI_SIGN), str(p), "--signed-at", "2026-02-02T00:00:00Z"],
        check=True, capture_output=True,
    )
    return p


def _load(p):
    b = json.loads(pathlib.Path(p).read_text())
    validate_bundle(b)
    return b


def test_positive_sign_then_python_verify(signed_bundle_path):
    b = _load(signed_bundle_path)
    assert "attestation" in b, "aura-sign.mjs must attach attestation"
    r = verify_attestation(b["attestation"], b["session"], b["session"]["decisions"], load_signing_keys())
    assert r["pass"] is True, r
    assert r["code"] == "verified"


def test_positive_full_suite_pass(signed_bundle_path):
    b = _load(signed_bundle_path)
    suite = run_suite(b)
    assert suite["overall"] == "PASS"
    t = next(t for t in suite["tests"] if t["id"] == "impl:attestation-signature")
    assert t["status"] == "PASS", t


def test_positive_node_and_python_agree_on_signed_bundle(signed_bundle_path):
    n = subprocess.run(["node", str(NODE_CLI_VERIFY), str(signed_bundle_path), "--json"],
                       capture_output=True, text=True)
    assert n.returncode == 0, n.stderr
    node_suite = json.loads(n.stdout)
    py_suite = run_suite(_load(signed_bundle_path))
    for tid in ["impl:attestation-signature", "impl:hash-integrity", "impl:chain-continuity"]:
        a = next(t["status"] for t in node_suite["tests"] if t["id"] == tid)
        b = next(t["status"] for t in py_suite["tests"] if t["id"] == tid)
        assert a == b == "PASS", f"node/py mismatch on {tid}: node={a} py={b}"


def _mutate(src_path, tmp_path, mut):
    b = json.loads(src_path.read_text())
    mut(b)
    q = tmp_path / f"{mut.__name__}.json"
    q.write_text(json.dumps(b, indent=2))
    return q


def _payload_tamper(b): b["session"]["decisions"][2]["reason"] = "post-sign"
def _bad_sig(b):        b["attestation"]["signature"] = "00" * 64
def _unknown_key(b):    b["attestation"]["key_id"] = "aura-key-not-in-registry"
def _malformed(b):      b["attestation"].pop("signature")


@pytest.mark.parametrize("mut,expected_code", [
    (_payload_tamper, "payload_mismatch"),
    (_bad_sig,        "bad_signature"),
    (_unknown_key,    "unknown_key"),
    (_malformed,      "malformed_attestation"),
], ids=[m[0].__name__ for m in [
    (_payload_tamper,), (_bad_sig,), (_unknown_key,), (_malformed,),
]])
def test_negative_attestation(signed_bundle_path, tmp_path, mut, expected_code):
    bad = _mutate(signed_bundle_path, tmp_path, mut)
    b = _load(bad)
    r = verify_attestation(b["attestation"], b["session"], b["session"]["decisions"], load_signing_keys())
    assert r["pass"] is False
    assert r["code"] == expected_code, r


def test_revoked_key():
    # Fabricate an attestation claiming the demo-revoked key. Even if the
    # signature format were valid, revocation MUST fire first.
    b = {
        "attestation_version": "1.0", "algorithm": "ed25519",
        "key_id": "aura-key-2025-revoked-demo-001",
        "signed_at": "2025-06-01T00:00:00Z",
        "signed_payload": "{}", "signature": "00" * 64,
    }
    r = verify_attestation(b, {"session_id": "x"}, [], load_signing_keys())
    assert r["pass"] is False
    assert r["code"] == "revoked_key"


def test_out_of_window(signed_bundle_path, tmp_path):
    bad = _mutate(signed_bundle_path, tmp_path,
                  lambda b: b["attestation"].__setitem__("signed_at", "2020-01-01T00:00:00Z"))
    b = _load(bad)
    r = verify_attestation(b["attestation"], b["session"], b["session"]["decisions"], load_signing_keys())
    assert r["pass"] is False
    assert r["code"] == "out_of_window"


def test_ed25519_pure_python_vs_node(signed_bundle_path):
    """Pure-Python Ed25519 verifier must accept every Node-produced signature
    and reject every mutated one — exact bit-for-bit compatibility."""
    b = _load(signed_bundle_path)
    att = b["attestation"]
    keys = {k["key_id"]: k for k in load_signing_keys()}
    entry = keys[att["key_id"]]
    pub = bytes.fromhex(entry["public_key_hex"])
    sig = bytes.fromhex(att["signature"])
    msg = att["signed_payload"].encode("utf-8")
    assert ed_verify(pub, msg, sig) is True
    # Flip one byte of message → must reject.
    tampered = msg[:5] + b"X" + msg[6:]
    assert ed_verify(pub, tampered, sig) is False
    # Flip one byte of signature → must reject.
    bad_sig = bytes([sig[0] ^ 1]) + sig[1:]
    assert ed_verify(pub, msg, bad_sig) is False
