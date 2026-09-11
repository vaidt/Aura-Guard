"""Cross-implementation agreement tests (Node CLI vs Python verifier).

Runs the same bundle through both and asserts semantic agreement per test id
and overall. Read-only: byte-for-byte equality of the on-disk bundle after
verification. NOT a normative Aura Protocol conformance claim.
"""
import json, subprocess, tempfile, shutil, hashlib, pathlib, sys, os
import pytest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from aura_verify import run_suite, validate_bundle  # noqa: E402

REPO = pathlib.Path("/app")
NODE_CLI = REPO / "cli" / "aura-verify.mjs"
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
  buildEvidenceBundle({rawSession: meta, decisions: chained, importedHadEvidence: false}), null, 2));
"""


@pytest.fixture(scope="session")
def clean_bundle_path(tmp_path_factory):
    d = tmp_path_factory.mktemp("bundles"); p = d / "clean.json"
    mk = d / "mk.mjs"; mk.write_text(MK_BUNDLE)
    subprocess.run(["node", str(mk), str(p)], check=True)
    return p


def node_run(path):
    r = subprocess.run(["node", str(NODE_CLI), str(path), "--json", "--no-cross-impl"], capture_output=True, text=True)
    return r.returncode, json.loads(r.stdout) if r.stdout.strip() else None, r.stderr


def py_run(path):
    bundle = json.loads(pathlib.Path(path).read_text()); validate_bundle(bundle)
    return run_suite(bundle)


def _agree(a, b):
    assert a["overall"] == b["overall"], f"overall mismatch: {a['overall']} vs {b['overall']}"
    # impl:cross-implementation is inherently local to each verifier (Node
    # spawns Python, Python cannot spawn itself), so it's excluded from
    # cross-agreement — matches /app/frontend/tests/crossImpl.test.mjs.
    a_ids = {t["id"] for t in a["tests"]}
    b_ids = {t["id"] for t in b["tests"]}
    ids = (a_ids & b_ids) - {"impl:cross-implementation"}
    for tid in ids:
        sa = next(t["status"] for t in a["tests"] if t["id"] == tid)
        sb = next(t["status"] for t in b["tests"] if t["id"] == tid)
        assert sa == sb, f"{tid}: node={sa} py={sb}"


def test_positive_agreement(clean_bundle_path):
    n_code, n_out, _ = node_run(clean_bundle_path); p_out = py_run(clean_bundle_path)
    assert n_code == 0 and n_out["overall"] == "PASS" and p_out["overall"] == "PASS"
    _agree(n_out, p_out)


def _mutate(src, tmp_path, fn):
    b = json.loads(src.read_text()); fn(b); q = tmp_path / f"{fn.__name__}.json"
    q.write_text(json.dumps(b, indent=2)); return q


MUTATIONS = [
    ("reason",         lambda b: b["session"]["decisions"][2].update(reason="X")),
    ("canonical_hash", lambda b: b["session"]["decisions"][2]["evidence"].update(canonical_hash="0"*64)),
    ("chain_hash",     lambda b: b["session"]["decisions"][2]["evidence"].update(chain_hash="a"*64)),
    ("prev_hash",      lambda b: b["session"]["decisions"][2]["evidence"].update(prev_hash="f"*64)),
    ("policy_version", lambda b: b["session"]["decisions"][2].update(policy_version="policy-UNKNOWN")),
    ("reordering",     lambda b: b["session"]["decisions"].__setitem__(slice(1,3), list(reversed(b["session"]["decisions"][1:3])))),
    ("removal",        lambda b: b["session"]["decisions"].pop(2)),
]


@pytest.mark.parametrize("name,mut", MUTATIONS, ids=[m[0] for m in MUTATIONS])
def test_negative_agreement(clean_bundle_path, tmp_path, name, mut):
    mut.__name__ = name
    bad = _mutate(clean_bundle_path, tmp_path, mut)
    n_code, n_out, _ = node_run(bad); p_out = py_run(bad)
    assert n_code == 1, f"node exit for {name}"
    assert n_out["overall"] == "FAIL" and p_out["overall"] == "FAIL", f"{name}: both must FAIL"
    _agree(n_out, p_out)


def test_read_only_byte_equality(clean_bundle_path):
    before = clean_bundle_path.read_bytes()
    h1 = hashlib.sha256(before).hexdigest()
    node_run(clean_bundle_path); py_run(clean_bundle_path)
    after = clean_bundle_path.read_bytes()
    assert before == after and hashlib.sha256(after).hexdigest() == h1


def test_malformed_bundle_both_reject(tmp_path):
    bad = tmp_path / "bad.json"; bad.write_text(json.dumps({"nope": True}))
    r = subprocess.run(["node", str(NODE_CLI), str(bad), "--json", "--no-cross-impl"], capture_output=True, text=True)
    assert r.returncode == 2
    with pytest.raises(Exception):
        py_run(bad)


def test_versions_are_distinct():
    p = py_run(pathlib.Path(os.environ.get("PYTEST_CURRENT_TEST", ""))) if False else None
    # Compare declared versions from module constants directly
    from aura_verify import PY_VERIFIER_VERSION, PROTOCOL_VERSION, BUNDLE_VERSION
    assert PROTOCOL_VERSION == "unspecified"
    assert PY_VERIFIER_VERSION.startswith("aura-verify-py/")
    assert isinstance(BUNDLE_VERSION, int) and BUNDLE_VERSION == 1
