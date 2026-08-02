# PHASE Reset preservation

**Status:** R1 preservation evidence  
**Product-canon effect:** None  
**Source revision:** `7a8fcfc0282f8afa9b0a5adee6279494df349455`

This directory preserves compact, reviewable evidence of the application that
existed before Reset / PHASE 2.0 implementation began.

It does not define the replacement architecture, resolve open decisions, or
authorize deletion. The Project Bible remains authoritative for target
behavior.

## Contents

- `R1_PRESERVATION_MANIFEST.md` — scope, source identity, captures, limitations,
  and verification.
- `fixtures/current-engine-catalog.v1.json` — current scene/engine identities,
  reachability, timing generation, and capture status.
- `fixtures/phase-align-reference.v1.json` — deterministic output from the
  current normalized-phase implementation.
- `fixtures/data-preservation-inventory.v1.json` — repository, Supabase,
  storage, browser, and URL/session data that must be protected before
  superseded-code removal.

Generated screenshots and future recordings remain outside Git. Their companion
`capture-index.json` records file sizes and SHA-256 hashes.

## Boundary

These records preserve what existed. A preserved behavior may be valuable,
obsolete, incomplete, or defective. Inclusion is not approval to carry it into
the replacement product.
