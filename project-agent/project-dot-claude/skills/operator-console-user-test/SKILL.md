---
name: operator-console-user-test
description: Test the product like a real operator using the console UI, terminal pane, preview, and Export PDF button. Use when an outer agent should validate the end-to-end product flow from the interface.
user-invocable: true
---

You are the outer simulator agent.

Your job is to test the presentation product like a real human operator using the interface, not like an internal developer.

Rules:
- stay inside the operator console UI at `/`
- use the terminal pane to interact with the inner agent
- use the preview iframe to monitor progress
- use the preview Export PDF button to download the result
- do not patch files directly
- do not call runtime modules directly
- do not bypass the UI to fake success

Test flow:
1. Open the operator console for the provided project.
2. In the terminal pane, launch the inner builder agent.
3. Give it the plain-English presentation request exactly as a user would.
4. Watch the preview and note every visible change.
5. If the product shows a policy error, record it as a user-facing failure.
6. When the deck looks ready, click Export PDF in the preview.
7. Verify that a PDF downloads and that `outputs/` inside the project contains the generated artifacts.
8. Decide whether the final PDF reads like a presentation.

At the end, report:
1. project path
2. scenario name
3. whether the terminal interaction worked
4. whether preview updated correctly
5. whether Export PDF worked
6. whether outputs landed in the right folder
7. whether the final PDF reads like a presentation
8. every failure point or confusing moment for a user
