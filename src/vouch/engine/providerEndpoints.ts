/** Official/native API base URLs used by VH provider configuration.
 * These are endpoints only; credentials never live here or in browser storage.
 */
export const PROVIDER_ENDPOINTS = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com",
  google: "https://generativelanguage.googleapis.com",
} as const;

export const PROVIDER_ENDPOINT_NOTES = {
  openai: "OpenAI API; keep API keys server/native-side only.",
  anthropic: "Anthropic API; native SDK/API endpoint.",
  google: "Gemini API native endpoint; Google also exposes an OpenAI-compatible interface.",
} as const;
