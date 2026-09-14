# OSS Agent Substrate — VH 17.10.9

VH 17.10.9 adopts an explicit vendoring boundary for mature TypeScript OSS agent technology.
The production runtime talks only to VH-owned `SpecialistContract` and adapter interfaces.
This prevents an upstream framework from becoming the security or authorization boundary.

## Selected projects

- **Mastra** — core framework is Apache-2.0; directories named `ee/` are under the Mastra Enterprise License and are intentionally excluded from the VH production import boundary. See the upstream license mapping: https://github.com/mastra-ai/mastra
- **VoltAgent** — MIT licensed TypeScript framework. https://github.com/VoltAgent/voltagent
- **Vercel AI SDK** — Apache-2.0 TypeScript AI toolkit. https://github.com/vercel/ai

The build environment used for this patch had no network/DNS access, so upstream source archives could not be fetched into the ZIP. To avoid pretending otherwise, these directories contain adapter manifests rather than copied third-party source. The runtime and registry are fully VH-owned and ready for a source drop-in at these exact boundaries.
