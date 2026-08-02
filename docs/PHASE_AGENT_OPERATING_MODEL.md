# PHASE Agent Operating Model

**Version:** Operations v1
**Status:** PLANNED — approved for operational use
**Scope:** Project coordination and agent-assisted work
**Product-canon effect:** None

---

## 1. Purpose and authority

This document defines how PHASE uses human direction, Codex, Lovable, specialist agents, worktrees, skills, integrations, and automations.

It does not change the Project Bible, promote exploratory ideas, resolve UNRESOLVED decisions, authorize implementation by itself, grant external access, or authorize publication or deployment.

Authority remains:

1. explicit current project-owner instruction;
2. accepted entries in `docs/DECISIONS.md`;
3. the hierarchy in `AGENTS.md`;
4. this operating model for operational questions only.

The project owner remains PHASE's creative and product authority.

---

## 2. Operating principles

1. **Human direction is authoritative.** Agents may investigate, propose, implement approved work, and verify results. They may not silently make product, canon, publishing, privacy, security, or architectural decisions that require approval.
2. **The repository is institutional memory.** Chat history supports work; approved documents and decision records govern it.
3. **Status labels remain explicit.** LOCKED / CANON, PLANNED, EXPLORATORY, UNRESOLVED, and SUPERSEDED / REJECTED must not be blurred.
4. **Roles are durable; agents are task-scoped.** A role may be instantiated as a subagent, persistent Codex task, worktree task, or proven automation.
5. **Read-only is the default.** Repository and external writes require explicit scope. External write approval is separate from repository write approval.
6. **Evidence outranks consensus.** Agent agreement is not proof; material conclusions need documents, code, tests, measurements, primary sources, or reproducible evidence.
7. **One writer owns a change surface.** Codex, Lovable, and human editors must not modify overlapping files concurrently.
8. **Automation follows a successful manual workflow.** Inputs, outputs, failure behavior, permissions, approvals, and recovery must be understood before recurrence is enabled.
9. **Least privilege applies.** Having a tool or credential does not authorize its use.
10. **The owner approves consequential transitions.** Approval for a proposal does not imply approval to implement, merge, publish, deploy, or automate it.
11. **Cost is an architectural constraint.** Use the smallest capable team, least expensive suitable model tier, narrowest relevant context, and shortest sufficient output without reducing the required quality or safety.

---

## 3. Organization

```text
Project Owner
└── PHASE HQ
    ├── Systems Engineering
    ├── Product and Worldbuilding Lab
    ├── Visual Direction Lab
    ├── Technical Art
    ├── Backend and Security
    ├── QA and Red Team
    └── Content Studio
```

PHASE HQ coordinates work and returns consolidated evidence to the project owner. Specialists do not silently transfer their authority to other specialists.

---

## 4. Role cards

### 4.1 Project Owner

**Owns:** Creative direction, product meaning, canon, accepted decisions, material scope, publication, deployment, credentials, and external-service authorization.

### 4.2 PHASE HQ

**Mandate**

- Maintain the integrated project view.
- Interpret requests against the Project Bible and implementation.
- Classify work, identify dependencies, and prepare task briefs.
- Commission specialists and reconcile their outputs.
- Protect scope, status labels, and approval boundaries.
- Present evidence, risks, recommendations, and decisions to the owner.

**Restrictions**

- Cannot promote exploration to canon.
- Cannot authorize publication for the owner.
- Cannot hide material specialist disagreement.
- Cannot treat task completion as proof of correctness.

**Activation:** The primary PHASE Codex task.

### 4.3 Systems Engineering

**Owns:** Musical time, audio scheduling, Trigger Engine contracts, normalized phase, macro closure, audiovisual event identity, application architecture, engineering tests, and performance-critical implementation.

**Must read:** `docs/AUDIO_RHYTHM_ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/GLOSSARY.md`, and task-relevant product documents.

**Restrictions**

- No competing rhythm authority.
- No geometry-owned note timing.
- No unapproved tuning, pause, transition, or arrival policy.
- No broad rewrite before tracing current behavior and product purpose.

**Activation:** Worktree task for implementation; bounded read-only agent for tracing or review.

### 4.4 Product and Worldbuilding Lab

**Owns:** Transit experience, routes, locations, cultures, institutions, lore, narrative coherence, journey mechanics, and progression proposals.

**Must read:** `docs/PHASE_VISION.md`, `docs/GAME_SYSTEMS.md`, `docs/WORLD_LORE.md`, `docs/CONTEXT_INDEX.md`, `docs/GLOSSARY.md`, and `docs/DECISIONS.md`.

**Required discipline**

- Separate canon, in-world knowledge, belief, and creator-unresolved truth.
- Label alternatives and contradictions.
- Preserve mysteries and unresolved names.
- Do not add conventional systems merely because they are familiar.

**Activation:** Persistent read-only Codex task only when an active assignment benefits from continuing creative context.

### 4.5 Visual Direction Lab

**Owns:** Moodboards, reference research, visual language, color, material, lighting, typography, composition, motion, exclusions, and source/licensing records.

**Must read:** `docs/VISUAL_DIRECTION.md`, `docs/PHASE_VISION.md`, `docs/WORLD_LORE.md`, `docs/CONTEXT_INDEX.md`, and `docs/DECISIONS.md`.

**Required output:** Annotate what each reference contributes, what must not be copied, which PHASE surface it informs, and what remains unresolved.

**Restrictions:** Generated imagery and missing-reference reconstructions are not accepted art direction.

**Activation:** Persistent read-only Codex task only when assigned; artifact tools only when requested.

### 4.6 Technical Art

**Owns:** Canvas, WebGL, shaders, particles, procedural environments, transitions, motion systems, visual prototypes, rendering budgets, reduced motion, and device behavior.

**Required output:** Prototype or scoped implementation, performance evidence, viewport behavior, accessibility behavior, and confirmation that visuals do not alter musical timing.

**Restrictions:** Technique does not redefine art direction; decorative fidelity does not outrank audio timing.

**Activation:** Isolated prototype or implementation worktree.

### 4.7 Backend and Security

**Owns:** Supabase schema, migrations, functions, authentication, storage, RLS, journey persistence, authoritative shared state, privacy, abuse prevention, idempotency, and recovery.

**Required output:** Authorization model, migration plan, policy analysis, transaction/retry behavior, tests, and recovery notes.

**Restrictions:** No live-state changes, production credentials, or service-role use without explicit authorization.

**Activation:** Worktree task plus fresh security review for consequential changes.

### 4.8 QA and Red Team

**Owns:** Independent requirement, regression, security, lifecycle, performance, accessibility, timing, and documentation review.

**Required output:** Severity-ordered findings, evidence, safe reproduction steps where appropriate, test gaps, and a pass, conditional-pass, or fail recommendation.

**Restrictions:** Read-only unless separately authorized to implement. Distinguish confirmed defects, inference, recommendations, and unresolved product choices.

**Activation:** Fresh agent or separate task for each material review.

### 4.9 Content Studio

**Owns:** High-integrity content candidates, uniqueness controls, technical quality, curation, copy, review batches, approved scheduling, and read-only performance reporting.

**Must read:** `docs/CONTENT_MARKETING_OPERATIONS.md` and all product documents relevant to the content.

**Restrictions**

- No scheduling or publication without required approval.
- No fabricated progress, dates, features, partnerships, or lore.
- No filler to satisfy a quota.
- No credentials or generated media in Git.
- No automatic product or canon changes based on engagement.

**Activation:** Deferred until the project owner declares marketing readiness. Later: supervised manual workflow first; persistent task and automation only after successful dry runs.

---

## 5. Codex operating surfaces

| Need | Preferred surface |
|---|---|
| Durable repository instruction | `AGENTS.md` |
| Product or architecture truth | Project Bible and accepted decisions |
| Company operating rules | This document |
| Repeatable specialist workflow | Codex skill |
| Independent bounded work | Subagent |
| Continuing user-visible workstream | Separate Codex task |
| Isolated implementation | Worktree task |
| Scheduled work | Automation |
| Authorized external data/action | Plugin, app, MCP server, API, or browser |
| Live interface iteration | Lovable during an explicit edit window |

A role definition grants no tool, credential, repository-write, or external-action authority.

---

## 6. Cost and token governance

### 6.1 Quality floor

Cost optimization must not weaken:

- architectural or product invariants;
- security and privacy review;
- migration safety;
- timing and audiovisual correctness;
- evidence required for consequential decisions;
- independent review where risk warrants it.

The cheapest failed workflow can cost more than one well-routed expert pass. High-risk work should go directly to the model tier capable of completing it reliably.

### 6.2 Model routing

Use capability tiers rather than permanently binding roles to model names:

| Tier | Use |
|---|---|
| Economy | File discovery, inventories, deterministic extraction, mechanical checks, simple formatting, and other low-risk bounded work |
| Standard | Routine implementation, tests, UI work, ordinary research, and scoped synthesis |
| Frontier | Cross-system architecture, musical timing, security, migrations, ambiguous product integration, difficult debugging, and final synthesis of consequential work |

Start at the lowest tier that is reasonably expected to succeed. Escalate when evidence shows uncertainty, failed verification, cross-system risk, or repeated retries. Do not send a complex task through multiple cheaper failed attempts merely to avoid a direct frontier pass.

Reasoning effort follows the same rule: use low or medium by default; reserve high or greater effort for genuinely difficult or consequential work.

### 6.3 Team-size and concurrency limits

- Default: one primary agent and no subagents.
- Add a specialist only when its work is independent and materially useful.
- Add an independent reviewer for material or high-risk changes.
- Normal complex-task ceiling: one primary agent, up to two bounded specialists, and one reviewer.
- Larger teams require a written cost and dependency justification.
- Do not keep agents running, polling, or producing status output without active work.
- Parallelism is for latency reduction, not automatic thoroughness.

### 6.4 Context discipline

- Route agents to exact files and sections instead of pasting the complete Project Bible into every prompt.
- Use `AGENTS.md` and `docs/CONTEXT_INDEX.md` to select governing documents.
- Search before opening large files; inspect relevant symbols and call sites before broad reading.
- Give reviewers the brief, governing requirements, diff or artifact, and verification evidence rather than the entire implementation conversation.
- Reuse fresh verified findings and accepted repository artifacts; do not commission duplicate full audits.
- Prefer structured handoffs over repeated narrative summaries.
- Keep outputs as short as completeness permits.

### 6.5 Tool-first verification

Use deterministic tools for deterministic questions:

- repository search and static inspection before model speculation;
- tests, type checks, linters, and scripts instead of repeated reasoning;
- hashes and manifests for identity;
- benchmarks and measurements for performance;
- machine-readable diffs and structured API output for external actions.

Reusable tests and scripts are long-term token-cost reductions.

### 6.6 Task cost envelope

Every material task brief should define:

- cost class: SMALL, MEDIUM, or LARGE;
- chosen model tier and reasoning effort;
- maximum primary agents and specialists;
- maximum retry or escalation count;
- context scope;
- expected output size;
- verification required;
- conditions that justify exceeding the envelope.

Where exact usage is available, record it. Otherwise record practical proxies: agents used, model tiers, retries, long-running tools, and duplicated work avoided.

### 6.7 Cost review

PHASE HQ should periodically review:

- which task types cause retries;
- where frontier models prevent rework;
- where economy or standard models are sufficient;
- which repeated reasoning should become a test, script, index, or skill;
- which tasks or automations produce little value;
- whether concurrency is saving time or only multiplying output.

Numeric token or currency budgets remain a project-owner decision and may vary by plan or provider.

---

## 7. Work lifecycle

1. **Intake:** Record outcome, motivation, constraints, affected systems, deliverable, and whether the request is exploratory or implementation-authorized.
2. **Classification:** Identify research, decision support, documentation, implementation, generation, review, external action, or automation.
3. **Context review:** Read governing documents; identify accepted decisions, invariants, unresolved questions, implementation evidence, and conflicts.
4. **Task brief:** Use `docs/AGENT_TASK_PROTOCOL.md`; define scope, permissions, verification, stop conditions, and approvals.
5. **Execution:** Keep read-only work read-only; isolate significant implementation; report deviations; stop on unapproved product decisions.
6. **Independent review:** For material work, review requirements, invariants, regressions, tests, security, privacy, performance, accessibility, and documentation.
7. **Owner review:** Present outcome, complete relevant diff or artifacts, verification, risks, unresolved decisions, and external actions awaiting approval.
8. **Integration:** Commit only approved files; preserve history; synchronize with Lovable; verify the integrated result; publish only when separately authorized.
9. **Closure:** Record changes, verification, remaining risks, follow-ups, and decision/documentation updates.

---

## 8. Git and Lovable rules

- Inspect Git status before writes and preserve unrelated work.
- Stop before overwriting an existing file unless approved.
- Use one implementation owner per file surface and worktrees for concurrent significant changes.
- Do not let Lovable and Codex edit overlapping files concurrently.
- Do not force-push, rebase, amend, squash, or rewrite published history.
- Keep generated media, temporary reports, and credentials out of implementation commits.
- Publishing the application is separate from merging code.
- After a Lovable edit window, inspect its complete commit and run Codex verification.

---

## 9. Handoffs and memory

Agents must return structured handoffs containing:

- task, scope, and status;
- governing documents and evidence;
- work completed;
- files or artifacts;
- verification;
- unresolved questions and risks;
- external actions;
- model tier, agent count, retries, and available usage evidence;
- Git status;
- recommended next step and approval state.

Important decisions must be persisted through the authorized documentation process. Task history is supporting context, not a substitute.

---

## 10. Approval boundaries

Explicit project-owner approval is required before:

- changing an accepted decision or architectural invariant;
- promoting EXPLORATORY material or resolving an UNRESOLVED question;
- changing production data, schema, RLS, storage policy, or credentials;
- connecting an external service with write authority;
- scheduling or publishing content;
- deploying or publishing the application;
- merging material implementation when review was requested;
- creating recurring external-write automation.

Approval is limited to the named artifact and next action.

---

## 11. Initial activation

1. Approve Operations v1 documents.
2. Keep PHASE HQ as the only standing active task.
3. Instantiate Product and Worldbuilding or Visual Direction tasks only when they receive concrete assignments.
4. Create worktree tasks for Systems Engineering, Technical Art, and Backend implementation only as needed.
5. Use fresh QA agents for material reviews rather than maintaining an idle review team.
6. Perform workflows manually and record cost proxies.
7. Extract only repeated, proven workflows into skills.
8. Connect tools with least privilege when a current task requires them.
9. Add automations only after successful dry runs and an explicit cost envelope.
10. Keep Content Studio inactive until the project owner declares marketing readiness.

---

## 12. Unresolved operational choices

Operations v1 does not decide:

- permanent task roster;
- skill roster;
- integrations;
- named-model mappings for each capability tier;
- numeric token, currency, concurrency, and retry budgets;
- schedules;
- marketing channels, cadence, or batch size;
- release cadence;
- whether PHASE eventually needs a separate operations repository or external orchestrator.

These choices should be made from observed needs.

---

## 13. Change control

Changes require a demonstrated operational problem, proposed wording, impact analysis, and project-owner approval. This document cannot override `AGENTS.md`, accepted decisions, or Project Bible authority.
