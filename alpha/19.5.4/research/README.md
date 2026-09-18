# research/ — the analysis this increment came from

**Not part of the product build.** Nothing in this folder ships in the app, is imported by any module, or appears in the bundle. It is here so the reasoning behind the five additions is auditable: *why these, why not the other hundred, and what was ruled out for licensing reasons.*

| File | What it is |
|---|---|
| `FEATURE-ABSORPTION-MAP.md` | 16-section map of the wider agent-tooling ecosystem: what exists, what is worth taking, what is a trap, ranked top-15 absorption order |
| `OPENBOT-FEATURE-INVENTORY.md` | Complete feature inventories of the **two separate** OpenBot projects (CopilotKit/OpenBot and openbot.run), side by side, with per-feature verdicts and ten transferable lessons |
| `EXTRACTION-MAP.md` | The ranked extraction plan (E1–E8), the VH-moat table, the "do not take" list, and the red-wire file list |
| `OSS-LICENSE-MAP.md` | Licence table and routing verdicts: what is copyable into a closed-source product, what is clean-room only, what is forbidden |
| `INTEGRATION-PLAN.md` | Enterprise-maturity plan: differentiation target, order of operations |
| `seam-scan.mjs` | Zero-dependency Node CLI that audits a repo for integration seams — `node research/seam-scan.mjs [path] [--json]` |

**The three conclusions this increment actually rests on:**

1. **Absorb few, absorb deeply.** Five features that make the product defensibly different beat forty features that make it look busy. Everything in the map that did not serve "each user's agents work directly with other users' agents" was declined.
2. **Licence decides the method, not the ambition.** Policy semantics came from a **MIT** project and were therefore *reimplemented clean-room*. openbot.run's UI is **PolyForm Noncommercial** — its *ideas* informed the design and none of its code, layout or assets were used; the watch affordance is VH's own beacon mark rather than an eye.
3. **The moat is accountability, not capability.** Free open-source agents sell capability. What a buyer cannot get for free is a receipt that verifies offline, a crossing governed on both sides, and an export that maps to the EU AI Act with its gaps declared. Every addition here feeds that.
