from __future__ import annotations

import hashlib
import os
import shutil
import subprocess
import tempfile
import unittest
import zipfile
from email.message import Message
from pathlib import Path
from unittest.mock import patch

from aura_evidence_guard.hashing import git_blob_sha1_bytes, sha256_bytes, sha256_file
from aura_evidence_guard.manifest import create_manifest, verify_manifest, write_json_atomic
from aura_evidence_guard.preservation import verify_preservation_zip
from aura_evidence_guard.github_api import GitHubReadOnlyClient
from aura_evidence_guard.source_lock import verify_git_source
from aura_evidence_guard.ssh_sig import sign_evidence_sshsig, verify_sshsig, SignatureError


class HashingAndManifestTests(unittest.TestCase):
    def test_sha256_and_git_blob_oid(self):
        data = b"aura-evidence\n"
        self.assertEqual(sha256_bytes(data), hashlib.sha256(data).hexdigest())
        self.assertEqual(git_blob_sha1_bytes(data), hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest())

    def test_manifest_passes_then_detects_tampering_and_extra_file(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td) / "payload"
            root.mkdir()
            (root / "a.txt").write_bytes(b"original")
            manifest_path = Path(td) / "manifest.json"
            write_json_atomic(manifest_path, create_manifest(root))
            self.assertEqual(verify_manifest(root, manifest_path)["result"], "PASS")
            (root / "a.txt").write_bytes(b"changed")
            self.assertEqual(verify_manifest(root, manifest_path)["result"], "FAIL")
            (root / "extra.txt").write_text("extra", encoding="utf-8")
            self.assertEqual(verify_manifest(root, manifest_path)["result"], "FAIL")


class PreservationTests(unittest.TestCase):
    def test_zip_passes_crc_and_internal_hashes(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "preservation.zip"
            payloads = {"a.txt": b"alpha", "nested/b.txt": b"beta"}
            sums = "".join(f"{hashlib.sha256(value).hexdigest()}  {name}\n" for name, value in sorted(payloads.items()))
            with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zf:
                for name, value in payloads.items():
                    zf.writestr(name, value)
                zf.writestr("SHA256SUMS.txt", sums)
            result = verify_preservation_zip(path, sha256_file(path))
            self.assertEqual(result["result"], "PASS")
            self.assertEqual(result["checks_failed"], [])


class ReadOnlyGitHubTests(unittest.TestCase):
    def test_client_exposes_no_remote_mutation_api(self):
        client = GitHubReadOnlyClient(token="test-token")
        for name in ("post", "put", "patch", "delete", "merge", "dispatch_workflow", "create_pull_request"):
            self.assertFalse(hasattr(client, name), name)

    def test_branch_ref_is_encoded_and_uses_get_only(self):
        client = GitHubReadOnlyClient(token="test-token")
        calls = []
        def fake_get(path):
            calls.append(path)
            return {"name": "feature/audit", "commit": {"sha": "a" * 40}}, Message()
        with patch.object(client, "_api_get", side_effect=fake_get):
            result = client.branch("owner/repo", "feature/audit")
        self.assertEqual(result["commit"]["sha"], "a" * 40)
        self.assertEqual(calls, ["repos/owner/repo/branches/feature%2Faudit"])


class SourceLockTests(unittest.TestCase):
    def test_clean_pinned_checkout_is_verified_offline(self):
        if not shutil.which("git"):
            self.skipTest("git is not installed")
        with tempfile.TemporaryDirectory() as td:
            root = Path(td) / "repo"
            root.mkdir()
            def git(*args):
                env = {**os.environ, "GIT_AUTHOR_NAME": "Test", "GIT_AUTHOR_EMAIL": "test@example.com",
                       "GIT_COMMITTER_NAME": "Test", "GIT_COMMITTER_EMAIL": "test@example.com"}
                return subprocess.run(["git", *args], cwd=root, env=env, check=True,
                                      stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout.decode().strip()
            git("init", "-b", "main")
            p = root / "spec.txt"
            p.write_bytes(b"spec content\n")
            git("add", "spec.txt")
            git("commit", "-m", "seed")
            git("remote", "add", "origin", "https://github.com/vaidt/aura-specification.git")
            sha = git("rev-parse", "HEAD")
            blob = git("rev-parse", "HEAD:spec.txt")
            digest = hashlib.sha256(p.read_bytes()).hexdigest()
            result = verify_git_source(root, sha, "spec.txt", blob, digest, p.stat().st_size)
            self.assertEqual(result["result"], "PASS")
            self.assertEqual(result["governance_effect"], "NONE")


class SSHSIGTests(unittest.TestCase):
    def test_sign_and_verify_exact_evidence_bytes(self):
        if not shutil.which("ssh-keygen"):
            self.skipTest("OpenSSH ssh-keygen unavailable")
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            private_key = root / "test_ed25519"
            subprocess.run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-f", str(private_key)],
                           check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            private_key.chmod(0o600)
            message = root / "evidence.txt"
            message.write_bytes(b"observational evidence only\n")
            signature = root / "evidence.txt.sig"
            sign = sign_evidence_sshsig(message, private_key, signature)
            self.assertEqual(sign["namespace"], "aura-evidence")
            public = private_key.with_suffix(".pub").read_text(encoding="utf-8").split()
            allowed = root / "allowed_signers"
            allowed.write_text("evidence@example.test " + public[0] + " " + public[1] + "\n", encoding="utf-8")
            verified = verify_sshsig(message, signature, allowed, "evidence@example.test", "aura-evidence")
            self.assertEqual(verified["cryptographic_result"], "PASS")
            message.write_bytes(b"changed bytes\n")
            tampered = verify_sshsig(message, signature, allowed, "evidence@example.test", "aura-evidence")
            self.assertEqual(tampered["cryptographic_result"], "FAIL")
            with self.assertRaises(SignatureError):
                verify_sshsig(message, signature, allowed, "evidence@example.test", "aura-governance")


if __name__ == "__main__":
    unittest.main()
