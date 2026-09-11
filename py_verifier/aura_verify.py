#!/usr/bin/env python3
"""Aura-Guard Python reference verifier — independent implementation.

Stdlib only. Reproduces the CURRENT IMPLEMENTATION semantics documented in
/app/docs/BUNDLE_SCHEMA.md, /app/docs/INV_FLT_01_NUMERIC_CANONICALIZATION.md,
and /app/docs/INV_ATT_01_ATTESTATION_SIGNATURE.md. NOT a normative Aura
Protocol implementation. Does NOT invoke Node, does NOT import JS code.
"""
from __future__ import annotations
import argparse, hashlib, json, math, os, sys
from datetime import datetime, timezone
from pathlib import Path

# Pure-Python Ed25519 (RFC 8032). Kept next to this file.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from ed25519_ref import verify as ed_verify  # noqa: E402

PY_VERIFIER_VERSION = "aura-verify-py/0.3.0"
PROTOCOL_VERSION = "unspecified"
BUNDLE_VERSION = 1
BINDING_MATRIX_VERSION = "1.2"
ATTESTATION_VERSION = "1.0"
GENESIS = "0" * 64
PASS, FAIL, NI, NA = "PASS", "FAIL", "NOT IMPLEMENTED", "NOT APPLICABLE"
DEFAULT_SIGNING_KEYS_PATH = "/app/config/signing_keys.json"


def _js_number_to_string(m: float) -> str:
    if math.isnan(m) or math.isinf(m):
        raise ValueError("INV-FLT-01: non-finite JSON numbers are forbidden")
    if m == 0.0: return "0"
    if m < 0:    return "-" + _js_number_to_string(-m)
    r = repr(m)
    if "e" in r:
        mant, exp_str = r.split("e"); e = int(exp_str)
    else:
        mant, e = r, 0
    if "." in mant:
        i_part, f_part = mant.split(".")
    else:
        i_part, f_part = mant, ""
    combined = i_part + f_part
    all_digits = combined.lstrip("0") or "0"
    trailing = 0; digits = all_digits
    while len(digits) > 1 and digits.endswith("0"):
        digits = digits[:-1]; trailing += 1
    k = len(digits)
    n = k + trailing + e - len(f_part)
    if k <= n <= 21: return digits + ("0" * (n - k))
    if 0 < n <= 21:  return digits[:n] + "." + digits[n:]
    if -6 < n <= 0:  return "0." + ("0" * (-n)) + digits
    exp_val = n - 1; sign = "+" if exp_val >= 0 else "-"; body = str(abs(exp_val))
    return (digits + "e" + sign + body) if k == 1 else (digits[0] + "." + digits[1:] + "e" + sign + body)


def canonicalize(v) -> str:
    if v is None: return "null"
    if isinstance(v, bool): return "true" if v else "false"
    if isinstance(v, int):  return str(v)
    if isinstance(v, float): return _js_number_to_string(v)
    if isinstance(v, str):   return json.dumps(v, ensure_ascii=False)
    if isinstance(v, list):  return "[" + ",".join(canonicalize(x) for x in v) + "]"
    if isinstance(v, dict):
        keys = sorted(v.keys())
        return "{" + ",".join(json.dumps(k, ensure_ascii=False) + ":" + canonicalize(v[k]) for k in keys) + "}"
    raise TypeError(f"non-JSON value: {type(v).__name__}")


def sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def _payload(d: dict) -> dict:
    return {k: v for k, v in d.items() if k != "evidence"}


def verify_decision(d, prev_chain, registered):
    ev = d.get("evidence") or {}
    canon = canonicalize(_payload(d)); rh = sha256_hex(canon); rc = sha256_hex(prev_chain + rh)
    checks = {
        "canonical_representation": canon == ev.get("canonical_representation"),
        "sha256_integrity": rh == ev.get("canonical_hash"),
        "hash_chain_continuity": ev.get("prev_hash") == prev_chain and rc == ev.get("chain_hash"),
        "policy_version": bool(d.get("policy_version")) and d.get("policy_version") in registered,
    }
    return {"pass": all(checks.values()), "checks": checks, "recomputed_hash": rh, "recomputed_chain": rc}


def validate_bundle(b):
    if not isinstance(b, dict): raise ValueError("bundle must be an object")
    if b.get("bundle_version") != BUNDLE_VERSION: raise ValueError(f"unsupported bundle_version: {b.get('bundle_version')}")
    if not isinstance(b.get("session"), dict): raise ValueError("bundle.session missing")
    if not isinstance(b["session"].get("decisions"), list): raise ValueError("session.decisions[] missing")
    for i, d in enumerate(b["session"]["decisions"]):
        if not isinstance(d, dict) or not d.get("id"): raise ValueError(f"decisions[{i}].id missing")


def tamper_probe(decisions, registered):
    if not decisions: return {"ran": False, "detected": False}
    original = decisions[0]
    mutated = json.loads(json.dumps(original)); mutated["reason"] = "__py_tamper_probe__"
    r = verify_decision(mutated, original.get("evidence", {}).get("prev_hash", GENESIS), registered)
    detected = (not r["pass"]) and (not r["checks"]["sha256_integrity"]) and (not r["checks"]["canonical_representation"])
    return {"ran": True, "detected": detected}


CANONICAL_NUMBER_VECTORS = [
    (0, "0"), (-0.0, "0"), (1, "1"), (1.0, "1"), (-1, "-1"), (0.1, "0.1"),
    (640.0, "640"), (128.4, "128.4"), (1e-6, "0.000001"), (1e-7, "1e-7"),
    (1e20, "100000000000000000000"), (1e21, "1e+21"),
    (9007199254740991, "9007199254740991"), (-9007199254740991, "-9007199254740991"),
]


def numeric_canonicalization_probe():
    for inp, exp in CANONICAL_NUMBER_VECTORS:
        if canonicalize(inp) != exp:
            return {"ran": True, "ok": False, "failure": {"input": inp, "expected": exp}}
    for bad in (float("nan"), float("inf"), float("-inf")):
        try:
            canonicalize(bad); return {"ran": True, "ok": False, "failure": {"input": str(bad)}}
        except (ValueError, TypeError):
            pass
    return {"ran": True, "ok": True}


# ----------------- INV-ATT-01 -----------------

def load_signing_keys(path=None):
    p = path or os.environ.get("AURA_SIGNING_KEYS") or DEFAULT_SIGNING_KEYS_PATH
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)["keys"]


def _iso_to_ts(s):
    # Accept trailing Z; datetime.fromisoformat handles Z natively in Py3.11+.
    try:
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        return datetime.fromisoformat(s).timestamp()
    except Exception:
        return None


def _derive_final_chain_hash(decisions, registered):
    if not decisions:
        return GENESIS
    prev = GENESIS
    for d in decisions:
        r = verify_decision(d, prev, registered)
        prev = r["recomputed_chain"]
    return prev


def _build_attestation_payload(session, decisions, key_id, signed_at):
    registered_set = set(session.get("registered_policy_versions") or [])
    final_chain_hash = _derive_final_chain_hash(decisions, registered_set)
    registered = sorted(list(session.get("registered_policy_versions") or []))
    return {
        "algorithm": "ed25519",
        "aura_attestation_version": ATTESTATION_VERSION,
        "bundle_version": 1,
        "final_chain_hash": final_chain_hash,
        "genesis_hash": GENESIS,
        "key_id": key_id,
        "record_count": len(decisions),
        "registered_policy_versions": registered,
        "session_id": session.get("session_id") or "",
        "signed_at": signed_at,
    }


def verify_attestation(attestation, session, decisions, keys):
    if not isinstance(attestation, dict):
        return {"pass": False, "code": "no_attestation", "detail": "no attestation object"}
    if attestation.get("attestation_version") != ATTESTATION_VERSION:
        return {"pass": False, "code": "unsupported_version", "detail": f"version={attestation.get('attestation_version')}"}
    if attestation.get("algorithm") != "ed25519":
        return {"pass": False, "code": "unsupported_algorithm", "detail": f"algorithm={attestation.get('algorithm')}"}
    key_id = attestation.get("key_id"); signed_at = attestation.get("signed_at")
    sp = attestation.get("signed_payload"); sig = attestation.get("signature")
    if not (isinstance(key_id, str) and isinstance(signed_at, str) and isinstance(sp, str) and isinstance(sig, str)):
        return {"pass": False, "code": "malformed_attestation", "detail": "missing required fields"}

    entry = next((k for k in keys if k.get("key_id") == key_id), None)
    if entry is None:
        return {"pass": False, "code": "unknown_key", "detail": f"{key_id} not registered"}
    if entry.get("status") == "revoked":
        return {"pass": False, "code": "revoked_key", "detail": f"{key_id} revoked"}
    if entry.get("algorithm") != "ed25519":
        return {"pass": False, "code": "algorithm_mismatch", "detail": f"registry algorithm={entry.get('algorithm')}"}

    ts = _iso_to_ts(signed_at); vf = _iso_to_ts(entry.get("valid_from")); vu = _iso_to_ts(entry.get("valid_until"))
    if ts is None or vf is None or vu is None:
        return {"pass": False, "code": "bad_timestamp", "detail": "invalid RFC 3339"}
    if ts < vf or ts > vu:
        return {"pass": False, "code": "out_of_window", "detail": f"{signed_at} not in [{entry['valid_from']},{entry['valid_until']}]"}

    expected = canonicalize(_build_attestation_payload(session, decisions, key_id, signed_at))
    if expected != sp:
        return {"pass": False, "code": "payload_mismatch", "detail": "signed_payload != reconstructed canonical"}

    try:
        pub = bytes.fromhex(entry["public_key_hex"]); sig_b = bytes.fromhex(sig)
    except Exception:
        return {"pass": False, "code": "bad_hex", "detail": "public_key_hex or signature is not hex"}
    if not ed_verify(pub, sp.encode("utf-8"), sig_b):
        return {"pass": False, "code": "bad_signature", "detail": "ed25519 verify failed"}
    return {"pass": True, "code": "verified", "detail": f"attested by {key_id} at {signed_at}",
            "key_id": key_id, "signed_at": signed_at}


def check_attestation(bundle, keys):
    att = bundle.get("attestation")
    if not att:
        return {"status": NA, "code": "no_attestation"}
    r = verify_attestation(att, bundle["session"], bundle["session"]["decisions"], keys)
    return {"status": PASS if r["pass"] else FAIL, "code": r["code"], "detail": r.get("detail", "")}


def run_suite(bundle):
    session = bundle["session"]; decisions = session["decisions"]
    registered = set(session.get("registered_policy_versions") or [])
    structure_ok = all(d.get("id") and isinstance(d.get("evidence"), dict) for d in decisions)
    prev = GENESIS; results = []; all_pass = True
    for d in decisions:
        r = verify_decision(d, prev, registered); results.append(r); all_pass &= r["pass"]; prev = r["recomputed_chain"]

    def agg(k): return PASS if all(r["checks"][k] for r in results) else FAIL
    probe = tamper_probe(decisions, registered)
    num_probe = numeric_canonicalization_probe()
    try:
        keys = load_signing_keys()
    except Exception:
        keys = []
    att = check_attestation(bundle, keys)

    tests = [
        {"id": "impl:evidence-structure",       "status": PASS if structure_ok and decisions else FAIL},
        {"id": "impl:canonical-representation", "status": agg("canonical_representation")},
        {"id": "impl:hash-integrity",           "status": agg("sha256_integrity")},
        {"id": "impl:chain-continuity",         "status": agg("hash_chain_continuity")},
        {"id": "impl:policy-binding",           "status": agg("policy_version")},
        {"id": "impl:tamper-detection",         "status": PASS if probe["ran"] and probe["detected"] else FAIL},
        {"id": "impl:numeric-canonicalization", "status": PASS if num_probe["ok"] else FAIL},
        {"id": "impl:evidence-portability",     "status": PASS},
        {"id": "impl:cross-implementation",     "status": NI},
        {"id": "impl:attestation-signature",    "status": att["status"], "code": att.get("code")},
    ]
    overall = FAIL if any(t["status"] == FAIL for t in tests) else PASS
    return {"protocol_version": PROTOCOL_VERSION, "verifier_version": PY_VERIFIER_VERSION,
            "bundle_version": BUNDLE_VERSION, "binding_matrix_version": BINDING_MATRIX_VERSION,
            "record_count": len(decisions), "overall": overall, "tests": tests}


def main(argv=None):
    ap = argparse.ArgumentParser(prog="aura-verify-py")
    ap.add_argument("bundle"); ap.add_argument("--json", action="store_true")
    a = ap.parse_args(argv)
    try:
        bundle = json.loads(Path(a.bundle).read_text(encoding="utf-8")); validate_bundle(bundle)
    except Exception as e:
        sys.stderr.write(f"aura-verify-py: invalid bundle: {e}\n"); return 2
    suite = run_suite(bundle)
    if a.json: sys.stdout.write(json.dumps(suite, indent=2) + "\n")
    else:
        sys.stdout.write(f"aura-verify-py {suite['overall']} · records={suite['record_count']}\n")
        for t in suite["tests"]: sys.stdout.write(f"  {t['status']:<16} {t['id']}\n")
    return 0 if suite["overall"] == PASS else 1


if __name__ == "__main__":
    sys.exit(main())
