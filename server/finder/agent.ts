import Anthropic from "@anthropic-ai/sdk";

/**
 * Shared agentic loop for the finders. Runs Claude with web search + a single
 * "submit" tool, resuming through pause_turn until the model submits or ends.
 * Both stages (companies, contacts) use this — only their prompts and submit
 * tool differ. Budgets are generous because the finder is async (nobody waits).
 */

// Model for the finder. Change here to swap models for both stages at once.
export const MODEL = "claude-opus-4-8";

const MAX_STEPS = 12;
const MAX_WEB_SEARCHES = 20;
const MAX_TOKENS = 16000;

export interface AgentResult {
  /** The validated input of the submit tool, when the model submitted. */
  input?: Record<string, unknown>;
  /** Prose the model left instead of submitting (surfaced as a status note). */
  note?: string;
}

export async function runResearchAgent(opts: {
  apiKey: string;
  system: string;
  user: string;
  submitTool: Anthropic.Tool;
  /** Web-search cap for this run. Smaller for focused per-company passes. */
  maxSearches?: number;
}): Promise<AgentResult> {
  const client = new Anthropic({ apiKey: opts.apiKey });
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: opts.user }];

  for (let step = 0; step < MAX_STEPS; step++) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: "adaptive" },
      system: opts.system,
      tools: [
        { type: "web_search_20260209", name: "web_search", max_uses: opts.maxSearches ?? MAX_WEB_SEARCHES },
        opts.submitTool,
      ],
      messages,
    });
    const message = await stream.finalMessage();

    const submit = message.content.find(
      (b): b is Anthropic.ToolUseBlock =>
        b.type === "tool_use" && b.name === opts.submitTool.name,
    );
    if (submit) return { input: submit.input as Record<string, unknown> };

    if (message.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: message.content });
      continue;
    }

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return { note: text || "The finder didn't return a result." };
  }

  return { note: "The finder ran out of research steps before finishing." };
}
