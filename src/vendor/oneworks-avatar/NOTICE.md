# OneWorks Avatar — vendored engine

Adapted from https://github.com/oneworks-ai/avatar (MIT License,
Copyright (c) 2026-present One Works contributors — see LICENSE upstream).

Vouch Harbor vendors the engine core (geometry, compiled renderer, presets,
animations, native-preset conversion, InteractiveAvatar renderer) for the
Generalist's face. NOT vendored: the editor UI, export toolbars, pixelation /
GIF stack (gifenc). Local adaptations:

  · `@oneworks/avatar` imports redirected to `./core/index`
  · editor-only types mirrored in `editorTypes.ts`
  · pixel/GIF paths stubbed (VH renders the vector face)
  · a few unused internals exported or removed to satisfy VH's tsc gates

Original license text: https://github.com/oneworks-ai/avatar/blob/main/LICENSE
