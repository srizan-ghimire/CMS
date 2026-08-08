import { z } from "zod";
import type { PostStatus, SocialPlatform } from "./enums";

export const SEARCH_TYPES = ["post", "media", "campaign", "template", "snippet"] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

export const searchQuerySchema = z
  .object({
    workspaceId: z.string().cuid(),
    /**
     * Passed to Postgres `websearch_to_tsquery`, so users get the syntax they already know from
     * web search: "quoted phrases", -exclusions, and OR. No custom parser needed.
     */
    q: z.string().max(200).default(""),
    types: z
      .string()
      .optional()
      .transform((value) =>
        value
          ? (value.split(",").filter((t): t is SearchType => SEARCH_TYPES.includes(t as SearchType)))
          : undefined,
      ),
    status: z
      .string()
      .optional()
      .transform((value) => (value ? (value.split(",").filter(Boolean) as PostStatus[]) : undefined)),
    tagIds: z
      .string()
      .optional()
      .transform((value) => (value ? value.split(",").filter(Boolean) : undefined)),
    campaignId: z.string().cuid().optional(),
    socialAccountId: z.string().cuid().optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
export type SearchQuery = z.infer<typeof searchQuerySchema>;

export interface SearchHit {
  type: SearchType;
  id: string;
  title: string;
  /** ts_headline output — contains <mark> around matched terms. */
  snippet: string;
  rank: number;
  status?: PostStatus;
  platforms?: SocialPlatform[];
  thumbnailUrl?: string | null;
  updatedAt: string;
}

export interface SearchFacets {
  status: { value: string; count: number }[];
  tags: { id: string; name: string; count: number }[];
  campaigns: { id: string; name: string; count: number }[];
}

export interface SearchResponse {
  hits: SearchHit[];
  facets: SearchFacets;
  total: number;
}
