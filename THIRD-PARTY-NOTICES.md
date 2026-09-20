# Third-Party Notices

Vouch Harbor includes clean-room TypeScript implementations of token-
compression techniques proven in the open-source community. The following
projects informed the design of LOTUS (Lean Optimal Token Utilisation System,
`src/vh19/lotus.ts`); no source code from either project is included — the
implementations in this repository were written for VH's audited pipeline —
but their MIT licenses require this notice, and their authors have our thanks.

## context-compress (Open330)

- Project: https://github.com/Open330/context-compress
- Techniques informed: the compression mode ladder (conservative / balanced /
  aggressive / auto), dedup references for repeated tool output, and the
  net-win gate (skip any pass that would not pay for its own markers).
- License: MIT License. Copyright (c) 2026 Open330 and contributors.
- MIT license text: https://github.com/Open330/context-compress/blob/main/LICENSE

## LLMLingua (Microsoft Research)

- Project: https://github.com/microsoft/LLMLingua
- Techniques informed: the principle that a small, deterministic scorer can
  identify low-value tokens before inference — the research baseline for
  prompt compression (up to 20× with minimal performance loss). VH's LOTUS
  uses deterministic, model-free passes today; the LLMLingua line marks the
  path for model-scored compression later.
- License: MIT License. Copyright (c) Microsoft Corporation.
- MIT license text: https://github.com/microsoft/LLMLingua/blob/main/LICENSE

Permission is hereby granted, free of charge, to any person obtaining a copy
of the above-referenced software, to deal in the software without restriction,
including without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the software, subject to the
following conditions: the above copyright notice and this permission notice
shall be included in all copies or substantial portions of the software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
