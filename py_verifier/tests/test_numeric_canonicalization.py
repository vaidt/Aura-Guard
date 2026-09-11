"""INV-FLT-01 — Numeric canonicalization tests (Python side + JS parity).

Validates:
  1. Python `canonicalize` matches every fixture vector.
  2. Non-finite numbers are rejected.
  3. Cross-implementation parity: for every fixture, the JS canonicalizer
     (via a one-off Node inline script) produces byte-identical output.
"""
import json, math, subprocess, sys, pathlib
import pytest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from aura_verify import canonicalize, CANONICAL_NUMBER_VECTORS  # noqa: E402

JS_PARITY_SCRIPT = r"""
import { canonicalNumberString, CANONICAL_NUMBER_VECTORS }
    from "/app/frontend/src/lib/canonicalNumber.js";
const out = CANONICAL_NUMBER_VECTORS.map(({ input, expected }) => ({
    input,
    expected,
    actual: canonicalNumberString(input),
}));
process.stdout.write(JSON.stringify(out));
"""


@pytest.mark.parametrize("inp,expected", CANONICAL_NUMBER_VECTORS,
                         ids=[str(x[0]) for x in CANONICAL_NUMBER_VECTORS])
def test_python_matches_spec(inp, expected):
    assert canonicalize(inp) == expected


def test_python_rejects_non_finite():
    with pytest.raises(ValueError):
        canonicalize(float("nan"))
    with pytest.raises(ValueError):
        canonicalize(float("inf"))
    with pytest.raises(ValueError):
        canonicalize(float("-inf"))


def test_python_negative_zero_equals_positive_zero():
    assert canonicalize(-0.0) == "0"
    assert canonicalize(0.0) == "0"


def test_python_integer_float_collapse():
    # Guards against Python emitting "640.0" or "1.0"
    assert canonicalize(640.0) == "640"
    assert canonicalize(1.0) == "1"
    assert canonicalize([1.0, 640.0, 128.4]) == "[1,640,128.4]"


def test_js_python_parity(tmp_path):
    """JS canonicalNumberString(fixture) == Python canonicalize(fixture) for every vector."""
    script = tmp_path / "parity.mjs"
    script.write_text(JS_PARITY_SCRIPT)
    r = subprocess.run(["node", str(script)], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    js_out = json.loads(r.stdout)
    for row in js_out:
        # JS ↔ spec
        assert row["actual"] == row["expected"], f"JS spec drift on {row['input']}"
    # JS ↔ Python (already indirectly proven via spec, but assert directly)
    for row, (py_inp, py_expected) in zip(js_out, CANONICAL_NUMBER_VECTORS):
        assert row["expected"] == py_expected, "fixture order desync"
        assert row["actual"] == canonicalize(py_inp), f"JS↔Py mismatch on {py_inp}"
