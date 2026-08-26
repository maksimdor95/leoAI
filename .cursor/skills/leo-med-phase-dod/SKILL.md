---
name: leo-med-phase-dod
description: >-
  Verifies LEO Med vertical phase Definition of Done and readiness gates
  (Phase 0–3). Use when the user asks to check Med phase DoD, close a Med
  phase, run /leo-med-phase-dod, or asks whether ready to start Phase 1/2/3.
  Enforces binary met/not-met per .cursor/rules/dod-or-cut-scope.mdc —
  never «done with caveats».
---

# LEO Med — Phase DoD checker

Source of truth: `docs/MED_VERTICAL_BRIEF.md`.  
Code roots: `services/job-matching/src/services/med/`, `…/data/med/`.

## Modes

Ask which mode if unclear; default from phrasing:

| User intent | Mode |
|-------------|------|
| «проверь DoD Phase N», «закрой Phase N» | `verify` — DoD of phase N |
| «готово ли к старту Phase N», «ready for Phase N» | `ready` — gate **into** phase N |
| no N | ask N; for `ready` default **next unfinished** |

## Hard rules

1. Each criterion → **met** / **not met** only. No «mostly», no silent scope cut.
2. If any DoD item **not met** → phase is **not done**. List gaps; ask: close now or approve reduced DoD.
3. `ready` for Phase N requires **verify Phase N−1 = all met** (Phase 0 has no predecessor).
4. Do not mark Phase done in the brief until `verify` passes.
5. Jack IT isolation: Med must not pollute `tg_job_channels.json` or unscoped Jack feed.
6. Prefer evidence: read files, run `scripts/check-phase0.cjs` for Phase 0 data, run `npm test -- --testPathPattern=med` in `services/job-matching` when Med tests exist.

## Workflow

1. Read `docs/MED_VERTICAL_BRIEF.md` §6 (plan + DoD tables).
2. Load checklists from [reference.md](reference.md) for the target phase.
3. Gather evidence (code, JSON, tests, env docs).
4. Output the report template below.
5. On full pass for `verify`: offer to update brief DoD table to ✅ (do not edit unless user asks).
6. On full pass for `ready`: say **GO** and paste Phase N start DoD in one short block.

## Report template

```markdown
## LEO Med — {verify Phase N | ready for Phase N}

**Result:** PASS | FAIL

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | … | met / not met | path / command |

**Gaps:** (none | bullets)
**Next:** (GO Phase N+1 | close gaps | ask scope cut)
```

## Phase map (summary)

| Phase | Goal | Not in scope |
|-------|------|--------------|
| 0 | Registry + roles 434н + `ENABLE_MED_VERTICAL` off | ingest, bot feed, profiles |
| 1 | HH/SJ med ingest + role map + TG/web лента by profession | taxonomy LLM, B2B, full TG list |
| 2 | Taxonomy duties/skills/quals from official docs + `docs/med/taxonomy_meditsina_rf.md` | selling talent pool |
| 3 | Onboarding → profile + consent A; metric = N profiles (в чате, ветка `med_*`; TG bot = evolution) | LeoWork / fee / consent B required for clinic share |

Full criteria: [reference.md](reference.md).

## Automated checks

```bash
node .cursor/skills/leo-med-phase-dod/scripts/check-phase0.cjs
cd services/job-matching && npm test -- --testPathPattern=med --no-coverage
```

Phase 0 script exit 0 = data gate green; still run full `verify` checklist (flag wiring, Jack isolation, docs).

## After PASS verify

Remind: agreed-plan-full-delivery — only then start next phase.
