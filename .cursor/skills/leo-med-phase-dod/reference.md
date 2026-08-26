# LEO Med phase checklists

Product decisions (fixed): LEO Med only, RF, doctor+mid+junior + pharma/leadership/junior extras (2026-08-26), metric Phase 3 = N profiles with consent A, Phase 3 channel = web `/med` (TG bot = evolution), no Kabi. Consent draft: `docs/med/CONSENT_DRAFT.md`.

---

## Phase 0 — verify DoD

| # | Criterion | How to check |
|---|-----------|--------------|
| 1 | `med_sources.json` exists; boards HH/SJ/Rabota/Zarplata/Avito; all wife TG usernames; discovery ≥ trudvsem + emed | file / `check-phase0.cjs` |
| 2 | All sources have status planned \| active \| paused | JSON / `check-phase0.cjs` |
| 3 | `med_roles.json`: levels doctor/mid/junior; refs 5.1.1–5.1.124 + 5.2; 6.1–6.10; 9.1–9.57; 12.1–12.4 | `check-phase0.cjs` |
| 4 | Source cite = Приказ 434н + publication URL | JSON `source` |
| 5 | `isMedVerticalEnabled()` true **only** if `ENABLE_MED_VERTICAL=true`; default off | `med/config.ts` + test |
| 6 | Module exports: listMedRoles, listMedSources, listPlannedTgChannels | `med/index.ts` |
| 7 | Tests pass: `medCatalog` (or `med`) | jest |
| 8 | Jack isolation: no med channels in `tg_job_channels.json`; scrape path unchanged when flag off | grep / read |
| 9 | Docs: brief §6 Phase 0 table; `CONFIGURATION.md` has `ENABLE_MED_VERTICAL` | docs |
| 10 | Brand: `Med` in landing rotator (TG bot **not** required for Phase 0) | `HeroBrandRotator.tsx` |

**Out of Phase 0:** HH med filter, role classifier on jobs, TG bot feed, profiles, taxonomy.

---

## Ready for Phase 1

All Phase 0 verify rows **met**, plus:

| # | Gate | Notes |
|---|------|-------|
| A | Phase 0 PASS | required |
| B | Agreed Phase 1 DoD written (brief or this chat) before coding | no silent scope |
| C | Primary boards for v1 = HH + SuperJob (API already in LEO) | |
| D | TG: plan ≤5–7 channels from registry `priority=high`, not all 12 | |
| E | Explicit: separate Med entry (bot and/or flag), not Jack IT feed mix | |

---

## Phase 1 — verify DoD

| # | Criterion | How to check |
|---|-----------|--------------|
| 1 | Medicine-filtered ingest HH + SuperJob into catalog (or med-tagged jobs) | code + sample query |
| 2 | Vacancy → `med_role_id` mapper (aliases + fallback); confidence or unknown bucket | unit tests |
| 3 | Doctors end-to-end first; mid+junior same release or immediate follow (scope A+B) | code paths |
| 4 | Consumer: TG bot and/or Med web surface — лента **by profession** (+ optional city) | manual/smoke |
| 5 | Dedup with existing job-matching rules | tests / docs |
| 6 | TG secondary: 3–7 channels from med registry activated, not full list unless approved | `med_sources` status |
| 7 | `ENABLE_MED_VERTICAL` gates Med paths; Jack IT unaffected when false | tests |
| 8 | Brief §6 Phase 1 DoD table updated met/not met | docs |

**Out of Phase 1:** full taxonomy, profile onboarding KPI, B2B, «все вакансии РФ».

---

## Ready for Phase 2

Phase 1 verify PASS + taxonomy schema agreed in `docs/MED_VERTICAL_BRIEF.md` §6 Phase 2  
(expert Q&A 2026-08-26 + `docs/med/taxonomy_meditsina_rf.md`).

Gate B:

- duties + skills + qualifications (+ tasks from source file)
- provenance: `official` | `open_source` | `vacancy_parse` | `llm_draft`
- official docs first; foreign OK if RU; gaps from vacancies; LLM last
- coverage: all doctors + nurses (junior same schema)
- skills may overlap across roles
- Phase 3 profile fields noted: experience, docs/accreditation, city, employment type

---

## Phase 2 — verify DoD

| # | Criterion |
|---|-----------|
| 1 | Schema `MedRoleTaxonomy` in code: skills, duties, qualifications (+ optional tasks) |
| 2 | Provenance: `official` \| `open_source` \| `vacancy_parse` \| `llm_draft` |
| 3 | Loader from `docs/med/taxonomy_meditsina_rf.md` (or derived JSON); map titles → `med_role_id` |
| 4 | Coverage: doctors + nurses per expert; junior same schema |
| 5 | Shared skill codes allowed across roles |
| 6 | UI/docs disclaimer when not pure official |
| 7 | Tests for loader + schema |

**Out of Phase 2:** selling profiles, consent marketplace, full Phase 3 onboarding UI.

---

## Ready for Phase 3

Phase 2 PASS + consent copy drafted (`docs/med/CONSENT_DRAFT.md`, even if legal final later) + `med_roles` covers in-scope unmapped (pharma, leadership, сиделка/няня/…) per brief §6.1 — or explicit scope cut approved.

---

## Phase 3 — verify DoD

| # | Criterion | How to check |
|---|-----------|--------------|
| 1 | Onboarding: role resolved from the candidate's own answer | `GET /med/map-role?title=` + `med_confirm` step |
| 2 | Prefill taxonomy checklist; user can edit | `resolveMedTaxonomyForRole` → `med_skills` step |
| 3 | Fields: role, skills, duties, experience, docs/accreditation, city, employment type, **consent A** | steps `med_*` + POST body |
| 4 | Persist to `med_specialists` with consent flag | migration + `createMedSpecialist` |
| 5 | Metric instrumented: count completed profiles with consent A | `GET /med/profiles/stats` |
| 6 | No LeoWork / base sale without consent B + agreed N | consent B not required; docs/consent copy |
| 7 | Single entry point: chat only, no standalone `/med` pages | `frontend/app/med` absent; branch in `jackScenario` |

**Out of Phase 3:** TG bot required, consent B marketplace, selling pool.

---

## Wife TG usernames (registry must include)

`superjob_medicina`, `rabota_mediki`, `rabota_medsestra`, `Rabotat_v_meditsina1`, `Med_Job_4_you`, `csorglaborantmladpersonal`, `job_in_med`, `job_in_zdrav`, `hh_vacancy_medicine`, `med_vacancy`, `rehabilitation_vacancies`, `medsmena`
