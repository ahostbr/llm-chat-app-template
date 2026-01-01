/**
 * LLM Chat Application Template
 *
 * Updated to use OpenAI OSS model on Workers AI:
 *   @cf/openai/gpt-oss-120b
 *
 * gpt-oss models on Workers AI use the Responses API format:
 *   - instructions (system prompt)
 *   - input (string or array of { role, content })
 */
import { Env, ChatMessage } from "./types";

// OpenAI OSS model on Workers AI
const MODEL_ID = "@cf/openai/gpt-oss-120b";

// Default system prompt
const SYSTEM_PROMPT =
  "You are a helpful, friendly assistant. Provide concise and accurate responses.";

export default {
  /**
   * Main request handler for the Worker
   */
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    // Handle static assets (frontend)
    if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    // API Routes
    if (url.pathname === "/api/chat") {
      // Handle POST requests for chat
      if (request.method === "POST") {
        return handleChatRequest(request, env);
      }

      // Method not allowed for other request types
      return new Response("Method not allowed", { status: 405 });
    }

    // Handle 404 for unmatched routes
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

/**
 * Handles chat API requests
 */
async function handleChatRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    // Parse JSON request body
    const body = (await request.json()) as { messages?: ChatMessage[] };
    const messages: ChatMessage[] = Array.isArray(body?.messages)
      ? body.messages
      : [];

    // Ensure we have a system prompt (instructions)
    const systemMsg =
      messages.find((m) => m.role === "system")?.content ?? SYSTEM_PROMPT;

    // Responses-style input: pass conversation excluding system message
    const input = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    const stream = await env.AI.run(
      MODEL_ID,
      {
        // Responses API fields
        instructions: systemMsg,
        input,

        // Optional: reasoning control for gpt-oss models
        reasoning: { effort: "medium" },

        // Keep streaming SSE like the template
        stream: true,

        // If you hit output length issues, you can try this:
        // max_tokens: 1024,
      },
      {
        // Optional AI Gateway config (unchanged)
        // gateway: {
        //   id: "YOUR_GATEWAY_ID",
        //   skipCache: false,
        //   cacheTtl: 3600,
        // },
      },
    );

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
        connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error processing chat request:", error);
    return new Response(JSON.stringify({ error: "Failed to process request" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}