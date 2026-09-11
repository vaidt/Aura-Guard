"""Ed25519 pure-Python reference verifier.

Derived from RFC 8032 §6 / Appendix A (public domain). Stdlib only
(hashlib.sha512). Verify-only — no signing. Intended to keep the Python
reference verifier stdlib-only for third-party attestation checks.

Correctness is asserted by /app/py_verifier/tests/test_attestation.py via
cross-check against Node's built-in Ed25519.
"""
from __future__ import annotations
import hashlib

# --- curve constants ---
_p = 2**255 - 19
_q = 2**252 + 27742317777372353535851937790883648493
_d = -121665 * pow(121666, _p - 2, _p) % _p
_I = pow(2, (_p - 1) // 4, _p)


def _sha512_int(b: bytes) -> int:
    return int.from_bytes(hashlib.sha512(b).digest(), "little")


def _x_recover(y: int) -> int:
    xx = (y * y - 1) * pow(_d * y * y + 1, _p - 2, _p)
    x = pow(xx, (_p + 3) // 8, _p)
    if (x * x - xx) % _p != 0:
        x = (x * _I) % _p
    if x % 2 != 0:
        x = _p - x
    return x


# Base point B
_By = 4 * pow(5, _p - 2, _p) % _p
_Bx = _x_recover(_By)
_B = (_Bx % _p, _By % _p, 1, (_Bx * _By) % _p)  # extended (X, Y, Z, T)


def _point_add(P, Q):
    (X1, Y1, Z1, T1) = P
    (X2, Y2, Z2, T2) = Q
    A = (Y1 - X1) * (Y2 - X2) % _p
    B = (Y1 + X1) * (Y2 + X2) % _p
    C = 2 * T1 * T2 * _d % _p
    D = 2 * Z1 * Z2 % _p
    E = B - A
    F = D - C
    G = D + C
    H = B + A
    return (E * F % _p, G * H % _p, F * G % _p, E * H % _p)


def _scalar_mult(s: int, P):
    Q = (0, 1, 1, 0)  # neutral
    while s > 0:
        if s & 1:
            Q = _point_add(Q, P)
        P = _point_add(P, P)
        s >>= 1
    return Q


def _point_equal(P, Q) -> bool:
    (X1, Y1, Z1, _T1) = P
    (X2, Y2, Z2, _T2) = Q
    if (X1 * Z2 - X2 * Z1) % _p != 0:
        return False
    if (Y1 * Z2 - Y2 * Z1) % _p != 0:
        return False
    return True


def _decode_point(s: bytes):
    if len(s) != 32:
        raise ValueError("bad point length")
    y = int.from_bytes(s, "little")
    sign = (y >> 255) & 1
    y &= (1 << 255) - 1
    if y >= _p:
        return None
    x = _x_recover(y)
    if x & 1 != sign:
        x = _p - x
    P = (x, y, 1, (x * y) % _p)
    # subgroup check omitted (RFC 8032 §5.1.7 permits) — matches libsodium "batch" verify
    return P


def verify(public_key: bytes, message: bytes, signature: bytes) -> bool:
    """RFC 8032 Ed25519ph=false, pre-hash=false, dom = ''. Returns True iff
    the signature is valid."""
    if len(public_key) != 32 or len(signature) != 64:
        return False
    R_bytes = signature[:32]
    S = int.from_bytes(signature[32:], "little")
    if S >= _q:
        return False
    A = _decode_point(public_key)
    R = _decode_point(R_bytes)
    if A is None or R is None:
        return False
    k = _sha512_int(R_bytes + public_key + message) % _q
    # Check [S]B == R + [k]A
    lhs = _scalar_mult(S, _B)
    rhs = _point_add(R, _scalar_mult(k, A))
    return _point_equal(lhs, rhs)
