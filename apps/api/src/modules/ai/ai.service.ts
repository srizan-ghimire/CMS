import { BadRequestException, ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PLATFORM_LIMITS, type SocialPlatform } from "@social-platform/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkspacesService } from "../workspaces/workspaces.service";
import { AdminService } from "../admin/admin.service";
import { CONTENT_CREATE_ROLES } from "../workspaces/lib/roles";

export const AI_FEATURE_FLAG = "ai_agents";

export interface CaptionSuggestion {
  content: string;
  hashtags: string[];
  characterCount: number;
  withinLimit: boolean;
}

interface AnthropicResponse {
  content?: { type: string; text?: string }[];
  error?: { message?: string };
}

/**
 * Caption and hashtag assistance.
 *
 * Gated behind the `ai_agents` feature flag (created disabled by the seed) AND the presence of an
 * API key: an unconfigured deployment must fail with a clear message rather than a provider error
 * from deep inside an HTTP call.
 *
 * Deliberately a single request/response rather than the LangGraph multi-agent setup the roadmap
 * describes — a caption rewrite has no branching or tool use to orchestrate, so the graph would be
 * machinery without a job. The strategist/planner agents that do need it remain future work.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly apiKey: string;
  private readonly model = "claude-sonnet-4-5";

  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspacesService,
    private readonly admin: AdminService,
    private readonly config: ConfigService,
  ) {
    this.apiKey = this.config.get<string>("ai.anthropicApiKey") ?? "";
  }

  async isAvailable(userId: string): Promise<{ enabled: boolean; reason: string | null }> {
    if (!this.apiKey) {
      return { enabled: false, reason: "ANTHROPIC_API_KEY is not configured on the server." };
    }
    const flagged = await this.admin.isEnabled(AI_FEATURE_FLAG, userId);
    if (!flagged) {
      return { enabled: false, reason: "The ai_agents feature flag is off for this account." };
    }
    return { enabled: true, reason: null };
  }

  async suggestCaptions(
    input: {
      workspaceId: string;
      prompt: string;
      platforms: SocialPlatform[];
      tone?: string;
      count?: number;
    },
    userId: string,
  ): Promise<CaptionSuggestion[]> {
    await this.workspaces.assertMembership(input.workspaceId, userId, CONTENT_CREATE_ROLES);

    const availability = await this.isAvailable(userId);
    if (!availability.enabled) {
      throw new ForbiddenException(availability.reason ?? "AI assistance is unavailable.");
    }
    if (!input.prompt.trim()) {
      throw new BadRequestException("Describe what the post should be about.");
    }

    // Generate against the strictest selected platform so a suggestion is never immediately
    // over-limit in the composer.
    const limit =
      input.platforms.length > 0
        ? Math.min(...input.platforms.map((p) => PLATFORM_LIMITS[p].maxChars))
        : 2_200;
    const count = Math.min(Math.max(input.count ?? 3, 1), 5);

    const system = [
      "You write social media captions.",
      `Every caption must be under ${limit} characters.`,
      input.tone ? `Tone: ${input.tone}.` : "Match the tone of the brief.",
      "Return ONLY a JSON array, no prose and no code fences. Each element:",
      '{"content": "the caption", "hashtags": ["tag", "tag"]}',
      "Hashtags must not include the # symbol.",
    ].join(" ");

    const raw = await this.callModel(
      system,
      `Write ${count} distinct caption options for: ${input.prompt}`,
    );

    return this.parseSuggestions(raw, limit).slice(0, count);
  }

  private async callModel(system: string, user: string): Promise<string> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    const body = (await response.json().catch(() => ({}))) as AnthropicResponse;
    if (!response.ok) {
      // Never surface the raw provider payload — it can echo the request, and the API key lives
      // in the same call.
      this.logger.warn(`AI request failed (${response.status})`);
      throw new BadRequestException(
        body.error?.message ?? `The AI provider returned ${response.status}.`,
      );
    }

    return (body.content ?? [])
      .filter((part) => part.type === "text")
      .map((part) => part.text ?? "")
      .join("");
  }

  /** Models occasionally wrap JSON in prose or fences despite instructions, so parse defensively. */
  private parseSuggestions(raw: string, limit: number): CaptionSuggestion[] {
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start === -1 || end === -1) {
      throw new BadRequestException("The AI response could not be parsed. Try rephrasing.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.slice(start, end + 1));
    } catch {
      throw new BadRequestException("The AI response could not be parsed. Try rephrasing.");
    }
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((item): CaptionSuggestion[] => {
      if (!item || typeof item !== "object") return [];
      const content = String((item as { content?: unknown }).content ?? "").trim();
      if (!content) return [];
      const hashtags = Array.isArray((item as { hashtags?: unknown }).hashtags)
        ? ((item as { hashtags: unknown[] }).hashtags)
            .map((h) => String(h).replace(/^#/, "").trim())
            .filter(Boolean)
        : [];
      return [
        {
          content,
          hashtags,
          characterCount: content.length,
          // Reported rather than enforced: a slightly long suggestion is still useful as a
          // starting point, and the composer's counter already shows the overage.
          withinLimit: content.length <= limit,
        },
      ];
    });
  }
}
