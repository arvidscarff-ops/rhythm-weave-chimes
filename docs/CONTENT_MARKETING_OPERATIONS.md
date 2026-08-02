# PHASE Content Marketing Operations

**Version:** Operations v1
**Status:** PLANNED — department approved; activation deferred until project-owner readiness
**Scope:** Content generation, curation, approval, scheduling, and reporting
**Product-canon effect:** None

---

## 1. Intent

PHASE should automate content marketing as far as automation improves consistency, reach, and operational leverage without sacrificing artistic integrity, product quality, truthfulness, or human creative judgment.

The intended system is an editorial studio with automation, not an autonomous content mill.

The project owner retains final approval over what represents PHASE publicly, when and where content is scheduled, product and lore claims, visual and musical direction, and changes to publishing policy.

---

## 2. Confirmed operating principles

1. Candidate generation, technical validation, duplicate detection, and review preparation may be automated.
2. External scheduling or publication requires explicit approval.
3. Automation must not create filler to satisfy a quota.
4. Random variation alone does not establish meaningful uniqueness.
5. Agents may not fabricate features, progress, dates, partnerships, lore, or user response.
6. Marketing performance may inform editorial discussion but may not autonomously redefine PHASE.
7. Generated media and credentials must not be committed to Git.
8. Project Bible status and canon rules apply to public copy.
9. A smaller strong batch is preferable to a complete weak batch.
10. Approval of media does not automatically approve copy, channel, timing, or publication.

---

## 3. Current baseline

The repository contains a debug-oriented recorder in `src/lib/dev/recordScene.ts`, invoked by `Export test video` in `src/components/dock/PhaseDock.tsx`, with its original sketch in `.lovable/plan.md`.

It captures one live canvas, records a fixed silent ten-second 30 fps WebM, and downloads it locally. It has no deterministic seed contract, complete compositing, batch generation, manifest, duplicate ledger, platform packaging, storage, or publishing integration.

It remains useful for debugging and visual references. It is not a production social-content exporter.

---

## 4. Activation boundary

Marketing operations will not begin during the current stage of product development.

Until the project owner declares marketing readiness:

- do not create a persistent Content Studio task;
- do not create a Content Studio skill or automation;
- do not connect Buffer or social accounts;
- do not provision marketing media storage;
- do not implement the production capture pipeline solely for marketing;
- do not generate recurring content batches.

This document records the approved future operating intent only.

---

## 5. Objectives and non-goals

Content Studio should:

- produce reproducible audiovisual candidates from approved PHASE configurations;
- surface a small, varied, high-quality review batch;
- prevent exact and near-duplicate publication;
- preserve truthful musical and visual relationships;
- prepare channel-appropriate media and copy;
- keep publication behind approval;
- record generation, rejection, approval, scheduling, and publication;
- report performance without sacrificing identity.

Content Studio must not:

- maximize volume;
- imitate trends without artistic justification;
- turn unfinished exploration into public promises;
- replace the project owner's taste;
- create fake community activity;
- auto-reply without a separate approved policy;
- reuse unlicensed media;
- expose private or unreleased information;
- bypass platform or Buffer approval requirements.

---

## 6. Department roles

| Role | Responsibility | Prohibited authority |
|---|---|---|
| Producer | Select approved configurations, create deterministic render requests, render candidates, and produce manifests | Approving, scheduling, or publishing its own work |
| Quality Controller | Reject corrupt, frozen, clipped, mistimed, silent, malformed, or incomplete output | Waiving failures to fill a batch |
| Curator | Detect repetition, evaluate meaningful variety, select a shortlist, and explain each selection | Promoting exploration to canon or publishing |
| Copy Editor | Draft accurate platform-specific copy and accessibility text; flag unverifiable claims | Inventing product facts, lore, dates, or engagement bait |
| Publisher | Accept approved IDs and payloads, dry-run, schedule, and return external status | Choosing content or materially rewriting approved copy |
| Analyst | Report post status, performance, qualitative response, and failures | Automatically changing product, canon, cadence, or strategy |
| Project Owner | Approve creative candidates and final scheduling actions | Not delegated |

Publisher credentials must be unavailable to Producers, Curators, and research agents.

---

## 7. Content lifecycle

1. **Plan:** Define eligible material, candidate and shortlist targets, diversity rules, exclusions, channels under consideration, and required formats.
2. **Generate:** Assign a candidate ID and reproducible configuration before rendering.
3. **Technical QC:** Reject or rerender invalid output before artistic review.
4. **Deduplicate:** Compare the batch with current, approved, published, and relevant rejected material.
5. **Curate:** Select a coherent shortlist based on quality, identity, meaningful variety, and editorial purpose.
6. **Creative approval:** The owner approves or rejects individual candidate IDs.
7. **Package:** Prepare platform media, copy, accessibility text, credits, channel, time, and cover-frame proposal.
8. **Scheduling approval:** The owner approves the final publication package and external action.
9. **Schedule:** The Publisher creates a draft or scheduled post and records the external result.
10. **Verify:** Confirm draft, awaiting-approval, scheduled, sent, failed, removed, or superseded status.
11. **Review:** Return performance evidence to PHASE HQ as editorial evidence, not autonomous instruction.

---

## 8. Candidate identity

Each candidate manifest should include:

- candidate ID and creation time;
- renderer and schema version;
- source commit;
- Trigger Engine and implementation version;
- scene or blueprint and version;
- deterministic content seed;
- sound pack and pitch/scale configuration;
- voice, density, macro-cycle, and capture-start configuration;
- Phase Zero relationship;
- visual scene, palette, environment, camera, and framing;
- requested duration, frame rate, resolution, aspect ratio, and audio configuration;
- rendered file hash;
- QC and duplicate results;
- editorial, approval, and publication state.

The product does not yet have an accepted seed contract. Deterministic content generation must wait for or coordinate with the approved timing and randomness foundation.

---

## 9. Uniqueness and repetition

Uniqueness is evaluated at three levels.

### 9.1 Exact identity

A configuration fingerprint covers meaningful musical, visual, temporal, and editorial inputs. A published fingerprint is rejected unless the owner explicitly approves repetition.

### 9.2 Perceptual similarity

Comparison may use file hashes, sampled-frame perceptual hashes, multi-frame visual similarity, motion similarity, and audio fingerprints. Thresholds must be tested. Similarity tools may recommend rejection but are not the sole artistic judge.

### 9.3 Editorial diversity

A batch should avoid accidental concentration around one Trigger Engine, composition, pack, scale, palette, camera, environment, content pillar, or caption pattern.

Cooldowns and distribution targets are configurable operations policy, not product canon.

---

## 10. Quality standard

Approval should consider:

- whether the result feels recognizably PHASE;
- whether audio and visuals are truthful to the same events;
- whether it offers a meaningful experience or insight;
- whether it differs materially from recent output;
- phone legibility, crop safety, and platform overlays;
- intentional first frame and opening seconds;
- coherent loop or ending;
- specific and truthful copy;
- long-term artistic identity.

Technical validity alone is insufficient.

---

## 11. Candidate content pillars

These categories remain EXPLORATORY until approved:

- audiovisual excerpts;
- transit-world atmosphere;
- Trigger Engine studies;
- musical-system explanations;
- technical-art experiments;
- development journal fragments;
- approved lore fragments;
- route, location, or environment reveals;
- before-and-after design development;
- selected process material.

The owner must approve active pillars and public voice before automated copy becomes routine.

---

## 12. System boundary

### 12.1 PHASE capture surface

The application may expose an internal deterministic capture surface that accepts an approved configuration and seed, starts from a defined musical state, renders the intended composite with synchronized audio when required, and emits reproducible metadata.

It must not contain publishing credentials or social-platform logic.

### 12.2 Content Operations

A separate operations workflow owns batch selection, renderer control, media storage, QC, deduplication, review presentation, copy, approvals, Buffer submission, publication records, and reporting.

Generated media belongs in dedicated object storage with retention rules, not Git.

---

## 13. Media and publishing

Production requirements must be approved and checked against current platform rules. Expected concerns include vertical composition, safe framing, complete audiovisual capture, compatible encoding, duration and file-size validation, cover frames, and accessibility.

The current debug WebM is not a universal production master. Format and transcoding need a separate implementation decision.

Buffer is the proposed first publishing service, not a connected dependency. Its integration should:

- use the official API or CLI where possible;
- use browser control for preview, verification, or unsupported operations;
- store credentials outside Git;
- request minimum permissions;
- support dry runs and approval-required drafts;
- use idempotency and a publication ledger;
- return external post IDs, status, and errors;
- preserve a human-readable audit trail.

Media URLs must remain available until the publishing service has fetched and published them. Connecting Buffer, storing credentials, or scheduling a post requires separate authorization.

---

## 14. Approval, reliability, and analytics

An approval record identifies candidate and media version, copy version, channels, date or queue behavior, approver, approval time, restrictions, and any further platform approval. Material changes invalidate the approval.

The workflow must be safe to retry:

- generation and publication are separate;
- requests are not treated as proof of publication;
- external IDs are recorded before retry;
- duplicate submission is detected;
- partial channel failures are reported;
- credentials stay out of logs and manifests;
- source media remains until publication is verified;
- cancellation uses an authorized process.

Analytics are read-only editorial evidence. Reports should distinguish reach, views, completion where available, saves, shares, comments, qualitative response, failures, audience change, uncertainty, and missing data.

Analytics must not autonomously alter canon, cadence, frequency, or product direction.

---

## 15. Eventual cost controls

When activated, Content Studio should minimize cost by:

- rejecting ineligible or repeated configurations before rendering;
- generating low-resolution previews before production masters;
- rendering production versions only for shortlisted or approved candidates;
- caching manifests, hashes, frames, and reusable platform metadata;
- running perceptual comparison on sampled frames rather than every frame;
- drafting copy only for candidates that survive technical and editorial review;
- transcoding only the platform packages actually approved;
- bounding candidate count, retries, and agent roles per batch;
- using deterministic QC tools before model-based curation;
- avoiding continuous analytics polling;
- stopping a batch rather than expanding generation to fill a quota.

The eventual weekly task must have an explicit run-level cost envelope.

---

## 16. Automation maturity

| Stage | Capability |
|---|---|
| 0 — Manual | Generate and review one candidate; no publisher |
| 1 — Assisted batch | Test manifests, QC, deduplication, and review package; no external scheduling |
| 2 — Draft integration | Connect storage and Buffer; dry-run; create drafts only |
| 3 — Approved scheduling | Generate on a schedule; require creative and scheduling approval; schedule approved IDs only |
| 4 — Mature operations | Add status/performance reporting; change approval policy only through a new decision |

---

## 17. Proposed weekly cycle

A Sunday review cycle is PROPOSED, not fixed:

1. generate candidates before review;
2. reject failures and duplicates;
3. present a curated Sunday batch;
4. receive candidate-level approval;
5. prepare platform packages;
6. receive scheduling approval;
7. create Buffer drafts or schedules;
8. report post IDs and final schedule.

Time zone, time, candidate count, shortlist size, frequency, channels, and approval window remain UNRESOLVED.

---

## 18. Unresolved decisions

Content Studio does not yet decide:

- final pillars and public voice;
- batch size, cadence, schedule, and channels;
- per-channel reuse;
- duration, audio, captions, and subtitles;
- renderer and encoding;
- storage and retention;
- similarity thresholds;
- analytics provider;
- Buffer plan and approval settings;
- whether one or two approval gates remain after maturity;
- whether Content Operations belongs here or in a separate operations repository.

Agents must not select these answers merely to complete implementation.
