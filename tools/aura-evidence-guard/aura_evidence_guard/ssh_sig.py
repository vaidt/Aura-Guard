from __future__ import annotations

import hashlib
import os
import shutil
import stat
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from .manifest import GOVERNANCE_FIELDS


class SignatureError(ValueError):
    pass


def _tool() -> str:
    path = shutil.which("ssh-keygen")
    if path is None:
        raise SignatureError("OpenSSH ssh-keygen is required for SSHSIG operations")
    return path


def sign_evidence_sshsig(message: Path, private_key: Path, signature_output: Path,
                         passphrase: bytes | None = None) -> dict[str, Any]:
    if passphrase is not None:
        raise SignatureError("noninteractive_passphrase_signing_not_supported; use an unlocked key or SSH agent")
    message_input = message.expanduser().absolute()
    key_input = private_key.expanduser().absolute()
    if message_input.is_symlink() or key_input.is_symlink():
        raise SignatureError("message_and_private_key_symlinks_not_allowed")
    message = message_input.resolve(strict=True)
    private_key = key_input.resolve(strict=True)
    if not message.is_file() or not private_key.is_file():
        raise SignatureError("message_and_private_key_must_be_regular_files")
    if os.name == "posix" and stat.S_IMODE(private_key.stat().st_mode) & 0o077:
        raise SignatureError("private_key_group_or_world_permissions_not_allowed")
    output = signature_output.expanduser().absolute()
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists() or output.is_symlink():
        raise SignatureError("refusing_to_overwrite_signature")
    with tempfile.TemporaryDirectory(prefix="aura-sshsig-") as td:
        temporary_message = Path(td) / "evidence.bin"
        data = message.read_bytes()
        temporary_message.write_bytes(data)
        proc = subprocess.run(
            [_tool(), "-Y", "sign", "-f", str(private_key), "-n", "aura-evidence", str(temporary_message)],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False, timeout=30,
            env={**os.environ, "SSH_ASKPASS_REQUIRE": "never"},
        )
        generated = temporary_message.with_name(temporary_message.name + ".sig")
        if proc.returncode or not generated.is_file():
            raise SignatureError("ssh-keygen_sign_failed")
        signature_bytes = generated.read_bytes()
    try:
        fd = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "wb") as stream:
            stream.write(signature_bytes)
            stream.flush()
            os.fsync(stream.fileno())
    except Exception:
        output.unlink(missing_ok=True)
        raise
    return {
        "schema": "AURA-SSHSIG-SIGNATURE-RECORD/1.0", "result": "PASS", "namespace": "aura-evidence",
        "message": str(message), "signature": str(output), "message_sha256": hashlib.sha256(data).hexdigest(),
        **GOVERNANCE_FIELDS,
    }


def verify_sshsig(message: Path, signature: Path, allowed_signers: Path, identity: str,
                  namespace: str) -> dict[str, Any]:
    if namespace != "aura-evidence":
        raise SignatureError("only_aura_evidence_namespace_is_allowed")
    paths = {
        "message": message.expanduser().absolute(),
        "signature": signature.expanduser().absolute(),
        "allowed_signers": allowed_signers.expanduser().absolute(),
    }
    for label, path in paths.items():
        if path.is_symlink() or not path.is_file():
            raise SignatureError(label + "_must_be_a_regular_non_symlink_file")
    message = paths["message"].resolve(strict=True)
    signature = paths["signature"].resolve(strict=True)
    allowed_signers = paths["allowed_signers"].resolve(strict=True)
    proc = subprocess.run(
        [_tool(), "-Y", "verify", "-f", str(allowed_signers), "-I", identity,
         "-n", namespace, "-s", str(signature)],
        input=message.read_bytes(), stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        check=False, timeout=30,
    )
    return {
        "schema": "AURA-SSHSIG-VERIFICATION/1.0",
        "cryptographic_result": "PASS" if proc.returncode == 0 else "FAIL",
        "return_code": proc.returncode, "message": str(message), "signature": str(signature),
        "allowed_signers": str(allowed_signers), "identity_selector": identity, "namespace": namespace,
        "message_sha256": hashlib.sha256(message.read_bytes()).hexdigest(),
        "note": "A signature valid under the supplied allow-list does not prove independent trust, identity, authority competence, or normative effect.",
        **GOVERNANCE_FIELDS,
    }
