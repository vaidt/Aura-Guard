from __future__ import annotations

import hashlib
from pathlib import Path
from typing import BinaryIO


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while True:
            chunk = stream.read(chunk_size)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def git_blob_sha1_bytes(data: bytes) -> str:
    """Return Git's SHA-1 blob object ID for bytes, independently of Git's index."""
    header = b"blob " + str(len(data)).encode("ascii") + b"\0"
    # SHA-1 is required here to reproduce the repository's Git object format,
    # not used as a cryptographic signature or security digest.
    digest = hashlib.sha1(usedforsecurity=False)
    digest.update(header)
    digest.update(data)
    return digest.hexdigest()


def git_blob_sha1_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    size = path.stat().st_size
    digest = hashlib.sha1(usedforsecurity=False)
    digest.update(b"blob " + str(size).encode("ascii") + b"\0")
    with path.open("rb") as stream:
        while True:
            chunk = stream.read(chunk_size)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()
