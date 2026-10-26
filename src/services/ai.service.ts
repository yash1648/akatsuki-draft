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
   * Calls the configured Generative AI / Gemini LLM with timeout handling
   */
  async callLlm(input: LlmInput): Promise<LlmOutput> {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
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
          ? `${input.content.trim()}\n\n[Refined by Akatsuki Editorial AI for enhanced clarity and engagement]`
          : "Refined body content."
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const prompt = `You are an expert editorial AI for Akatsuki's Draft platform.
Your task is to improve clarity, grammar, flow, and engagement of the user's article while strictly preserving their core meaning, facts, and voice.
You MUST output ONLY a valid JSON object with the following three string keys:
{
  "title": "<improved title, max 150 chars>",
  "description": "<improved summary, max 300 chars>",
  "content": "<improved article body>"
}

Draft to improve:
${JSON.stringify(input, null, 2)}`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Upstream AI status ${response.status}: ${await response.text()}`);
      }

      const data: any = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error("Empty response from AI service");
      }

      const parsed: LlmOutput = JSON.parse(rawText);
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
