# PHASE Agent Task Protocol

**Version:** Operations v1
**Status:** PLANNED — approved for operational use
**Scope:** Task briefing, execution, review, approval, and handoff
**Product-canon effect:** None

---

## 1. Purpose

This protocol defines the minimum controls for PHASE work delegated to Codex tasks, subagents, specialist roles, Lovable, automations, or integrations.

It supplements `AGENTS.md`, `docs/PHASE_AGENT_OPERATING_MODEL.md`, the Project Bible, and accepted decisions. It never expands authority beyond the explicit task.

---

## 2. Task classes

| Class | Examples | Default authority |
|---|---|---|
| Read-only research | Repository trace, architecture map, reference research, consistency review | Inspect and report; no repository or external changes |
| Decision support | Compare clocks, visual directions, progression, or cadence | Present evidence and alternatives; do not choose an unresolved answer |
| Documentation | Add an approved document or record a decision | Change named documents only; preserve status discipline; show complete diff |
| Implementation | Feature, fix, refactor, tests, schema | Change approved files in an isolated worktree when significant; verify; do not publish |
| Independent review | Code, security, visual, performance, canon | Inspect and report; fixes require separate authority |
| Content generation | Moodboard, concept, candidate video, copy, lore alternatives | Create candidates; do not promote, merge, schedule, or publish |
| External action | Publish, deploy, send, schedule, mutate live data | Prohibited until exact target and action are approved |
| Automation | Weekly batch, scheduled check, recurring report | Create only after the manual workflow and approvals are validated |

---

## 3. Task status

Task status is operational and separate from Project Bible status.

- **DRAFT:** Brief incomplete.
- **READY:** Dependencies and permissions satisfied.
- **IN PROGRESS:** Work active.
- **NEEDS DECISION:** Product-owner choice required.
- **NEEDS APPROVAL:** A defined gate has been reached.
- **IN REVIEW:** Deliverable under review.
- **APPROVED:** Named deliverable may proceed to its named next action.
- **COMPLETE:** Required work and verification finished.
- **BLOCKED:** A specified input or state change is required.
- **CANCELLED:** Work intentionally stopped.

Approval applies only to the scope and next action named.

---

## 4. Standard task brief

```markdown
# Task

## Identity
- Task ID:
- Title:
- Class:
- Cost class:
- Status:
- Sponsor:
- Owning role:
- Reviewer:

## Outcome
- Goal:
- User value:
- Deliverable:

## Scope
- In scope:
- Out of scope:
- Allowed files or systems:
- Prohibited files or systems:

## Governing context
- Required documents:
- Accepted decisions:
- Relevant invariants:
- Implementation evidence:
- Unresolved questions:

## Authority
- Repository read/write:
- Stage/commit/push:
- External read/write:
- Credentials:
- Publish/deploy:

## Execution
- Dependencies:
- Assumptions:
- Required steps:
- Parallel work:
- Stop conditions:

## Cost controls
- Model tier:
- Reasoning effort:
- Maximum agents:
- Maximum retries/escalations:
- Context scope:
- Expected output size:
- Conditions for exceeding envelope:

## Verification
- Tests:
- Runtime:
- Visual:
- Security/privacy:
- Performance:
- Documentation:

## Approval gates
- Decision:
- Diff/artifact:
- External action:
- Integration:

## Handoff
- Summary:
- Files/artifacts:
- Evidence:
- Remaining risks:
- Recommended next action:
```

Minor tasks may be shorter, but scope, authority, verification, and stop conditions must remain explicit.

---

## 5. Permission defaults

| Permission | Default |
|---|---|
| Read relevant repository files | Allowed |
| Read relevant public primary sources | Allowed |
| Create safe temporary analysis outside Git | Allowed |
| Modify repository | Denied unless authorized |
| Stage, commit, push, or merge | Denied unless authorized |
| Rewrite published history | Prohibited |
| Install or upgrade dependencies | Denied unless authorized |
| Change live database or storage | Denied unless authorized |
| Use service-role credentials | Denied unless explicitly necessary and authorized |
| Connect an external app | Denied pending permission review |
| Send, schedule, publish, or deploy | Denied pending exact-action approval |
| Create recurring automation | Denied pending workflow approval |
| Exceed the task cost envelope | Denied pending justification or approval |

Possession of a tool or credential does not imply permission.

---

## 6. Assignment rules

### 6.1 Smallest capable team

Use one role when one role can complete the work safely. Use multiple agents when subtasks are independent, expertise materially differs, alternatives benefit from fresh context, or independent review is required.

Do not multiply agents merely to simulate rigor.

### 6.2 Separate author and reviewer

Material implementation should receive fresh review. The reviewer gets the brief, governing requirements, diff or artifact, and verification evidence—not the author's private reasoning.

### 6.3 Persistent tasks and worktrees

Persistent tasks are appropriate for recurring creative context or a continuing visible workstream. Significant implementation uses a task-specific worktree.

### 6.4 Bounded delegation

Every subagent assignment states the exact question, evidence scope, write authority, required output, and stop condition. The parent remains responsible for synthesis.

### 6.5 Cost and quality routing

- Default to one primary agent.
- Use the least expensive model tier reasonably expected to meet the task's quality and risk requirements.
- Use economy models for bounded mechanical work, standard models for routine implementation and synthesis, and frontier models for consequential architecture, timing, security, migrations, or difficult cross-system work.
- Go directly to the capable tier when cheaper attempts are likely to create rework.
- Use low or medium reasoning by default and raise it only when task difficulty or risk justifies it.
- Add specialists only for independent work with a defined deliverable.
- Use one independent reviewer for material work; avoid redundant layers of reviews without a stated purpose.
- Normal complex-task ceiling is one primary agent, two bounded specialists, and one reviewer.

### 6.6 Context and output discipline

- Give agents file paths and exact governing sections instead of duplicating whole documents in prompts.
- Search and inspect targeted call sites before reading broadly.
- Reuse fresh, verified repository findings and accepted artifacts.
- Give reviewers the brief, diff or artifact, and evidence—not the entire author conversation.
- Prefer structured tables, manifests, and handoffs to repeated prose.
- Do not repeat the same full report across HQ and specialist tasks.
- Keep status updates and final output concise while preserving material evidence.

### 6.7 Escalation and retry limits

- The brief defines maximum retries and escalation conditions.
- Stop repeating the same unsuccessful approach.
- Escalate model tier, request a decision, or change the technical approach when evidence warrants it.
- A larger agent team requires explicit cost and dependency justification.
- Deterministic tests and scripts should replace repeated model judgment wherever practical.

---

## 7. Read and scope controls

All agents read `AGENTS.md` and its task-routed documents. When status, provenance, terminology, or canon is uncertain, read `docs/CONTEXT_INDEX.md`, `docs/GLOSSARY.md`, `docs/DECISIONS.md`, and the governing document. Exact governing wording must not be replaced by a summary.

Before changes:

1. inspect Git status;
2. identify user changes;
3. confirm allowed files;
4. identify conflicts;
5. stop before unauthorized overwrite.

During work:

- preserve unrelated changes;
- avoid opportunistic cleanup;
- do not install or expand scope without authority;
- do not rewrite documentation to make code appear aligned;
- report necessary expansion instead of taking it silently.

---

## 8. Stop conditions

Stop and request direction when:

- a required product decision is UNRESOLVED;
- an accepted invariant would change;
- an existing file would be overwritten without approval;
- unrelated repository changes appear;
- credentials or authorization are missing;
- destructive action becomes necessary;
- verification reveals a materially different problem;
- publishing, deployment, or live mutation lacks approval;
- active writers overlap;
- completion requires material scope expansion.

Difficulty alone is not a stop condition while safe in-scope progress remains.

---

## 9. Verification

### Documentation

- only approved files changed;
- complete diff inspected;
- terminology, status, quotations, and links checked;
- supplied and unrelated documents unchanged;
- Git status reported.

### Code

- relevant tests and safe static/build checks run;
- callers and lifecycle verified;
- final diff inspected;
- skipped checks explained.

### Timing and audio

- event determinism, Phase Zero, macro closure, duplicates, missed events, frame-rate independence, lifecycle, suspension, long duration, and audiovisual identity checked.

### Backend

- authorization, RLS, transactions, retries, idempotency, migration safety, consistency, and recovery checked.

### Visual and content

- responsive/mobile behavior, reduced motion, accessibility, provenance, identity, duplication, and format checked.

### External action

- exact target and payload verified;
- dry run used where supported;
- approval recorded;
- idempotency checked;
- result ID and status returned;
- failure and recovery reported.

---

## 10. Approval protocol

An approval request states:

- exact artifact, file, target, or candidate ID;
- action the approval enables;
- exclusions;
- verification;
- known risks;
- reversibility.

Design, diff, commit, push/merge, content, copy, scheduling, and deployment approvals are separate unless explicitly combined.

---

## 11. Handoff

```markdown
## Handoff
- Task:
- Status:
- Governing documents read:
- Work completed:
- Files or artifacts:
- Evidence and verification:
- Decisions made:
- Decisions required:
- Risks and limitations:
- External actions:
- Cost class, model tier, agents used, and retries:
- Available token or cost evidence:
- Git status:
- Recommended next action:
```

Use `not applicable` rather than silently omitting a material category.

---

## 12. Review protocol

Reviewers prioritize:

1. correctness and user-visible regression;
2. security and privacy;
3. architectural invariants;
4. data loss and recovery;
5. timing and performance;
6. accessibility;
7. maintainability;
8. documentation accuracy.

Material findings distinguish CONFIRMED FROM CODE, INFERENCE, RECOMMENDATION, and UNRESOLVED, with evidence and practical consequence.

Passing tests alone does not complete review.

---

## 13. Definition of done

### Research or decision support

- governing sources read;
- evidence and inference separated;
- alternatives and tradeoffs clear;
- unresolved choices remain unresolved;
- no unauthorized write.

### Documentation

- only authorized documentation changed;
- complete diff reviewed;
- status and terminology preserved;
- supplied and unrelated files unchanged;
- Git status reported.

### Implementation

- requested behavior complete;
- scope authorized;
- verification passed or failures explicit;
- independent review complete when required;
- documentation and decisions consistent;
- owner approval gate reached.

### Content batch

- manifests complete;
- technical failures removed;
- duplicate checks complete;
- curation rationale present;
- nothing externally scheduled;
- owner review package complete.

### External action

- exact action approved;
- approved payload used;
- idempotency checked;
- result verified and reported;
- no broader permission exercised.

### Automation

- manual workflow succeeded;
- schedule and time zone explicit;
- permissions bounded;
- model tier, maximum run frequency, output limit, and cost envelope explicit;
- failure notification and disable behavior documented;
- approval gates preserved;
- dry run passed.

---

## 14. Artifact and Lovable handling

- Source code and approved documentation belong in Git.
- Generated media, large previews, and temporary analysis remain outside Git unless approved.
- Credentials never belong in Git.
- External assets retain source, license, and provenance.
- Temporary artifacts have retention rules.

For a Lovable edit window:

1. verify the connected branch is clean and synchronized;
2. stop overlapping Codex writers;
3. assign a narrow visual/interface task;
4. let Git synchronization complete;
5. inspect the resulting commit and complete diff;
6. run Codex verification;
7. resolve findings through a new approved task.

---

## 15. Automation and external safety

- Begin read-only where possible.
- Grant write scope only to the role that needs it.
- Keep publisher credentials from generators and researchers.
- Prefer structured APIs over brittle UI automation.
- Use browser control for visual verification or unsupported operations.
- Record external IDs and actual status.
- Never treat a request as proof of publication.
- Make automations visible, pausable, and removable.

---

## 16. Protocol changes

Changes require a demonstrated workflow problem, proposed wording, permission impact, and project-owner approval. This protocol cannot override current user instruction, `AGENTS.md`, accepted decisions, or Project Bible authority.
