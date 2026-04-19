---
name: review-visual-presentation
description: Run the artifact-only visual review swarm and write one canonical visual review JSON file. Use when a fresh visual review result is needed.
user-invocable: false
---

Read `.claude/AGENTS.md` first, then `.claude/CLAUDE.md` for Claude-specific helper guidance.

Then:
- do not edit presentation source files
- do not change code
- do not implement fixes
- use the full fixed visual reviewer bank every run
- spawn all reviewer sub-agents in parallel
- keep reviewer sub-agents artifact-only:
  - fresh PDF
  - outline
  - shared-protocol.md
  - one reviewer file each
- do not give reviewer sub-agents source files, slide ids, or code-level references
- synthesize the reviewer feedback into the single required JSON file
- overwrite the required output path with the latest visual review result
- do not persist raw reviewer transcripts or extra markdown companions

When complete, report only that the visual review JSON file was written.
