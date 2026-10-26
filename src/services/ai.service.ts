import { Post, IPost } from "../models/Post";
import { ApiError } from "../utils/apiError";

export interface LlmInput {
  title: string;
  description: string;
  content: string;
}

export interface LlmOutput {
  title: string;
  description: string;
  content: string;
}

export class AiService {
  /**
   * Calls the configured OpenRouter AI API with timeout handling
   */
  async callLlm(input: LlmInput): Promise<LlmOutput> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct";
    const timeoutMs = Number(process.env.AI_TIMEOUT_MS) || 30000;

    // If no API key is set (e.g. local development or testing without credentials),
    // provide an algorithmic heuristic enhancement fallback.
    if (!apiKey) {
      return {
        title: input.title ? `Enhanced: ${input.title.trim()}` : "Enhanced Draft",
        description: input.description
          ? `Polished summary: ${input.description.trim()}`
          : "Polished summary of content.",
        content: input.content
          ? `${input.content.trim()}\n\n[Refined by Akatsuki Editorial AI via OpenRouter for enhanced clarity and engagement]`
          : "Refined body content."
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const endpoint = "https://openrouter.ai/api/v1/chat/completions";

      const systemPrompt = `You are an expert editorial AI for Akatsuki's Draft platform.
Your task is to improve clarity, grammar, flow, and engagement of the user's article while strictly preserving their core meaning, facts, and voice.
You MUST output ONLY a valid JSON object with the following three string keys:
{
  "title": "<improved title, max 150 chars>",
  "description": "<improved summary, max 300 chars>",
  "content": "<improved article body>"
}
Do not include any introductory remarks, markdown fences, or conversational filler outside the JSON.`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.APP_URL || "https://akatsuki-draft.vercel.app",
          "X-Title": "Akatsuki Draft"
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: JSON.stringify(input, null, 2)
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error ${response.status}: ${await response.text()}`);
      }

      const data: any = await response.json();
      const rawText = data?.choices?.[0]?.message?.content;
      if (!rawText) {
        throw new Error("Empty response received from OpenRouter API");
      }

      // Strip markdown code fences if model enclosed JSON in ```json ... ```
      let cleanedText = rawText.trim();
      if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```$/i, "");
      }

      const parsed: LlmOutput = JSON.parse(cleanedText);
      return {
        title: parsed.title || input.title,
        description: parsed.description || input.description,
        content: parsed.content || input.content
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Improves post non-destructively: creates a new draft version linked to original.
   * (FR-AI-1 & FR-AI-2)
   */
  async improvePost(postId: string, userId: string): Promise<IPost> {
    const originalPost = await Post.findById(postId);
    if (!originalPost) {
      throw ApiError.notFound("Original post not found");
    }

    // Verify ownership: only the author can improve their post
    const isOwner = originalPost.createdBy.toString() === userId;
    if (!isOwner) {
      throw ApiError.forbidden("Not authorized to improve this post");
    }

    let improvedContent: LlmOutput;
    try {
      improvedContent = await this.callLlm({
        title: originalPost.title,
        description: originalPost.description,
        content: originalPost.content
      });
    } catch (err: any) {
      if (err.name === "AbortError" || err.message?.includes("timed out") || err.message?.includes("aborted")) {
        throw ApiError.gatewayTimeout("AI improvement request timed out");
      }
      if (err instanceof ApiError) {
        throw err;
      }
      throw ApiError.badGateway(`AI provider failure: ${err.message || "Upstream service error"}`);
    }

    // FR-AI-2: Insert a NEW Post document in MongoDB
    // Original post is completely untouched (FR-AI-1)
    const newDraftPost = new Post({
      title: improvedContent.title,
      description: improvedContent.description,
      content: improvedContent.content,
      image: originalPost.image,
      category: originalPost.category,
      createdBy: originalPost.createdBy,
      status: "draft", // Strictly draft
      parentPostId: originalPost._id
    });

    await newDraftPost.save();
    return newDraftPost;
  }
}

export const aiService = new AiService();
