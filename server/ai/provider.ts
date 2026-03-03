/**
 * LLM Provider Abstraction Layer
 *
 * Provider-agnostic interface for AI-powered analysis.
 * Currently supports OpenAI; designed for easy addition of
 * Anthropic, Google, or other providers.
 */

export interface LLMResponse {
  content: string;
  citations: Array<{ url: string; title: string }>;
}

export interface LLMCompleteOptions {
  systemPrompt: string;
  userPrompt: string;
  enableWebSearch?: boolean;
  responseFormat?: "json" | "text";
  temperature?: number;
}

export interface LLMProvider {
  readonly name: string;
  complete(options: LLMCompleteOptions): Promise<LLMResponse>;
}

export function createLLMProvider(): LLMProvider | null {
  const provider = process.env.AI_PROVIDER || "openai";

  switch (provider) {
    case "openai": {
      if (!process.env.OPENAI_API_KEY) {
        console.warn("[AI] OPENAI_API_KEY not set — risk agent will be unavailable");
        return null;
      }
      // Dynamic import to avoid loading SDK when not configured
      const { OpenAIProvider } = require("./openai");
      return new OpenAIProvider();
    }
    default:
      console.warn(`[AI] Unknown provider "${provider}" — risk agent will be unavailable`);
      return null;
  }
}
