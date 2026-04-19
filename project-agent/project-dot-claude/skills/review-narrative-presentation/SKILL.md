---
name: review-narrative-presentation
description: Run the artifact-only narrative review swarm and write one canonical narrative review JSON file. Use when a fresh narrative review result is needed.
user-invocable: false
---

Read `.claude/AGENTS.md` first, then `.claude/CLAUDE.md` for Claude-specific helper guidance.

Then:
- do not edit presentation source files
- do not change code
- do not implement fixes
- use the full fixed narrative reviewer bank every run
- spawn all reviewer sub-agents in parallel
- keep reviewer sub-agents artifact-only:
  - fresh PDF
  - brief
  - outline
  - shared-protocol.md
  - one reviewer file each
- do not give reviewer sub-agents source files, slide ids, or code-level references
- synthesize the reviewer feedback into the single required JSON file
- overwrite the required output path with the latest narrative review result
- do not persist raw reviewer transcripts or extra markdown companions

When complete, report only that the narrative review JSON file was written.
