/**
 * OpenAI LLM Provider
 *
 * Uses the OpenAI Responses API with web_search_preview tool
 * for real-time web search + analysis in a single API call.
 */

import OpenAI from "openai";
import type { LLMProvider, LLMResponse, LLMCompleteOptions } from "./provider";

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  private client: OpenAI;
  private model: string;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.model = process.env.OPENAI_MODEL || "gpt-4o";
  }

  async complete(options: LLMCompleteOptions): Promise<LLMResponse> {
    const { systemPrompt, userPrompt, enableWebSearch, responseFormat, temperature } = options;

    if (enableWebSearch) {
      return this.completeWithWebSearch(systemPrompt, userPrompt, responseFormat, temperature);
    }
    return this.completeChat(systemPrompt, userPrompt, responseFormat, temperature);
  }

  /**
   * Uses the Responses API with web_search_preview tool.
   * Single API call that searches the web AND generates analysis.
   */
  private async completeWithWebSearch(
    systemPrompt: string,
    userPrompt: string,
    responseFormat?: "json" | "text",
    temperature?: number,
  ): Promise<LLMResponse> {
    const response = await this.client.responses.create({
      model: this.model,
      instructions: systemPrompt,
      input: userPrompt,
      tools: [
        {
          type: "web_search_preview",
          search_context_size: "medium",
        },
      ],
      temperature: temperature ?? 0.3,
      text: responseFormat === "json"
        ? { format: { type: "json_object" } }
        : undefined,
    });

    // Extract text content and citations from the response
    const citations: Array<{ url: string; title: string }> = [];

    for (const item of response.output) {
      if (item.type === "message") {
        for (const part of item.content) {
          if (part.type === "output_text" && part.annotations) {
            for (const annotation of part.annotations) {
              if (annotation.type === "url_citation") {
                citations.push({
                  url: annotation.url,
                  title: annotation.title || annotation.url,
                });
              }
            }
          }
        }
      }
    }

    // Deduplicate citations by URL
    const uniqueCitations = Array.from(
      new Map(citations.map(c => [c.url, c])).values()
    );

    return {
      content: response.output_text,
      citations: uniqueCitations,
    };
  }

  /**
   * Falls back to Chat Completions API when web search is not needed.
   */
  private async completeChat(
    systemPrompt: string,
    userPrompt: string,
    responseFormat?: "json" | "text",
    temperature?: number,
  ): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: temperature ?? 0.3,
      response_format: responseFormat === "json"
        ? { type: "json_object" }
        : undefined,
    });

    return {
      content: response.choices[0]?.message?.content || "",
      citations: [],
    };
  }
}
