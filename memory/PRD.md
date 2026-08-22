# Aura-Guard Compliance Auditor — PRD

## Original problem statement
Build a professional web application called "Aura-Guard Compliance Auditor". Purpose: demonstrate how organizations can audit AI decisions and verify the integrity of their audit evidence. This is a product demonstrator, not an AI decision-maker. Core flows: dashboard, JSON log import + sample dataset, audit view, evidence verification view (canonical/SHA-256/hash-chain/policy version), tamper demonstration, printable compliance report. Deterministic demo data and verification logic. No ML / external AI / persistent identity. Label as demonstrator; do not claim EU AI Act certification.

## User choices (2026-02)
- Persistence: in-memory / single-session
- Report export: browser Print / Save as PDF
- Auth: open access
- Theme: dark enterprise (SOC console feel)
- Sample dataset: ~10 decisions
- Modular verification logic so it can later be replaced by the normative Aura Protocol

## Architecture
- Frontend (React + Tailwind + Shadcn UI) does all verification client-side via `SubtleCrypto` (SHA-256).
- Verification module (`src/lib/verification.js`) is isolated: canonicalize → SHA-256 → hash-chain → policy check.
- Sample session (`src/lib/sampleData.js`) with 10 deterministic decisions across two policy versions.
- Backend (FastAPI) exposes `GET /api/` and `GET /api/health`; kept minimal for future Aura Protocol backend swap.
- No MongoDB persistence (kept the connection wiring for future).

## User personas
- Compliance / audit operator running a demonstrator during Builder Fest.
- Regulator / stakeholder wanting to see how AI decisions are made tamper-evident.

## What's implemented (2026-02)
- Dashboard with session metadata, KPI cards, evidence-integrity status card, latest-entries ledger, Import JSON, Load sample.
- Audit view: dense table (desktop) + card list (mobile), per-decision evidence dialog with canonical/prev/chain hashes.
- Verification view: 4 aggregate check summary cards + full per-decision × per-check matrix (canonical / SHA-256 / hash-chain / policy).
- Tamper demonstration: select any decision, mutate any tamperable field, live re-verification cascades hash-chain failures downstream. Reset restores.
- Compliance report page: printable, 5 sections, PASS/FAIL badges, auditor attestation & disclaimer, print stylesheet.
- Print stylesheet strips dark theme for PDF export.

## Prioritized backlog
- P1: Multi-session history (requires switching to MongoDB persistence).
- P1: Downloadable canonical-JSON evidence bundle (`.json` export beside print).
- P2: Visual hash-chain graph (blocks with prev-hash arrows).
- P2: Policy registry management UI (add/remove registered policy versions).
- P2: Auditor sign-off with local key + detached signature over the report.
- P2: Server-side re-verification endpoint to prove logic is portable across implementations.

## Next tasks list
1. Add evidence-bundle download (canonical JSON + hashes) next to Print.
2. Add visual hash-chain diagram on Verification page.
3. Add policy registry management + drift warnings.
4. Optional: persist audit sessions in MongoDB with a Sessions list page.
