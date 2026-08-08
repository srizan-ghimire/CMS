import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  PostStatus,
  SearchFacets,
  SearchHit,
  SearchQuery,
  SearchResponse,
  SocialPlatform,
} from "@social-platform/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkspacesService } from "../workspaces/workspaces.service";
import { VIEW_ROLES } from "../workspaces/lib/roles";

interface PostSearchRow {
  id: string;
  title: string | null;
  content: string;
  status: PostStatus;
  updatedAt: Date;
  rank: number;
  snippet: string;
  platforms: SocialPlatform[] | null;
}

interface MediaSearchRow {
  id: string;
  fileName: string;
  thumbnailUrl: string | null;
  updatedAt: Date;
  rank: number;
  snippet: string;
}

/**
 * Postgres full-text search over posts and media, plus name matching for the organization
 * entities.
 *
 * Everything here is `$queryRaw` because Prisma cannot express tsvector at all (`@@fulltext` is
 * MySQL-only), so the columns are `Unsupported("tsvector")` and invisible to the query builder.
 * That means Prisma's usual injection protection does not apply automatically — every value is
 * therefore interpolated through `Prisma.sql` tagged templates, never string concatenation.
 */
@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspacesService,
  ) {}

  async search(query: SearchQuery, userId: string): Promise<SearchResponse> {
    await this.workspaces.assertMembership(query.workspaceId, userId, VIEW_ROLES);

    const types = query.types ?? ["post", "media", "campaign", "template", "snippet"];
    const term = query.q.trim();

    const [posts, media, others, facets] = await Promise.all([
      types.includes("post") ? this.searchPosts(query, term) : Promise.resolve([]),
      types.includes("media") ? this.searchMedia(query, term) : Promise.resolve([]),
      this.searchOrganization(query, term, types),
      this.facets(query),
    ]);

    const hits = [...posts, ...media, ...others]
      .sort((a, b) => b.rank - a.rank || b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, query.limit);

    return { hits, facets, total: hits.length };
  }

  /* ---------------------------------- Posts --------------------------------- */

  private async searchPosts(query: SearchQuery, term: string): Promise<SearchHit[]> {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`p."workspaceId" = ${query.workspaceId}`,
      Prisma.sql`p."deletedAt" IS NULL`,
    ];

    if (term) {
      // websearch_to_tsquery gives users the syntax they already know: "quoted phrases",
      // -exclusions and OR. It also never throws on malformed input, unlike to_tsquery.
      conditions.push(Prisma.sql`p."searchVector" @@ websearch_to_tsquery('english', ${term})`);
    }
    if (query.status?.length) {
      conditions.push(Prisma.sql`p."status"::text = ANY(${query.status})`);
    }
    if (query.campaignId) {
      conditions.push(Prisma.sql`p."campaignId" = ${query.campaignId}`);
    }
    if (query.from) {
      conditions.push(Prisma.sql`p."scheduledAt" >= ${new Date(query.from)}`);
    }
    if (query.to) {
      conditions.push(Prisma.sql`p."scheduledAt" <= ${new Date(query.to)}`);
    }
    // Tags cannot live in the generated tsvector (a generated column may only reference its own
    // row), so tag filtering is an EXISTS join rather than part of the match.
    if (query.tagIds?.length) {
      conditions.push(
        Prisma.sql`EXISTS (SELECT 1 FROM "post_tags" pt WHERE pt."postId" = p."id" AND pt."tagId" = ANY(${query.tagIds}))`,
      );
    }
    if (query.socialAccountId) {
      conditions.push(
        Prisma.sql`EXISTS (SELECT 1 FROM "post_targets" t WHERE t."postId" = p."id" AND t."socialAccountId" = ${query.socialAccountId})`,
      );
    }

    const rank = term
      ? Prisma.sql`ts_rank_cd(p."searchVector", websearch_to_tsquery('english', ${term}))`
      : Prisma.sql`0`;
    const snippet = term
      ? Prisma.sql`ts_headline('english', coalesce(p."content", ''), websearch_to_tsquery('english', ${term}), 'MaxFragments=1,MaxWords=25,MinWords=10')`
      : Prisma.sql`left(coalesce(p."content", ''), 160)`;

    const rows = await this.prisma.$queryRaw<PostSearchRow[]>`
      SELECT p."id", p."title", p."content", p."status", p."updatedAt",
             ${rank} AS "rank",
             ${snippet} AS "snippet",
             ARRAY(
               SELECT DISTINCT sa."platform"::text
               FROM "post_targets" t
               JOIN "social_accounts" sa ON sa."id" = t."socialAccountId"
               WHERE t."postId" = p."id"
             ) AS "platforms"
      FROM "posts" p
      WHERE ${Prisma.join(conditions, " AND ")}
      ORDER BY "rank" DESC, p."updatedAt" DESC
      LIMIT ${query.limit}
    `;

    return rows.map((row) => ({
      type: "post" as const,
      id: row.id,
      title: row.title || row.content.split("\n")[0]?.slice(0, 80) || "Untitled draft",
      snippet: row.snippet,
      rank: Number(row.rank),
      status: row.status,
      platforms: row.platforms ?? [],
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  /* ---------------------------------- Media --------------------------------- */

  private async searchMedia(query: SearchQuery, term: string): Promise<SearchHit[]> {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`m."workspaceId" = ${query.workspaceId}`,
      Prisma.sql`m."deletedAt" IS NULL`,
    ];

    if (term) {
      // The trigram fallback catches partial filenames ("logo_v2" finding "logo-v2-final"),
      // which full-text stemming alone misses because it tokenises on word boundaries.
      conditions.push(
        Prisma.sql`(m."searchVector" @@ websearch_to_tsquery('english', ${term}) OR m."fileName" ILIKE ${`%${term}%`})`,
      );
    }
    if (query.tagIds?.length) {
      conditions.push(
        Prisma.sql`EXISTS (SELECT 1 FROM "media_asset_tags" mt WHERE mt."mediaAssetId" = m."id" AND mt."tagId" = ANY(${query.tagIds}))`,
      );
    }

    const rank = term
      ? Prisma.sql`ts_rank_cd(m."searchVector", websearch_to_tsquery('english', ${term}))`
      : Prisma.sql`0`;

    const rows = await this.prisma.$queryRaw<MediaSearchRow[]>`
      SELECT m."id", m."fileName", m."thumbnailUrl", m."updatedAt",
             ${rank} AS "rank",
             coalesce(m."altText", m."caption", m."fileName") AS "snippet"
      FROM "media_assets" m
      WHERE ${Prisma.join(conditions, " AND ")}
      ORDER BY "rank" DESC, m."updatedAt" DESC
      LIMIT ${query.limit}
    `;

    return rows.map((row) => ({
      type: "media" as const,
      id: row.id,
      title: row.fileName,
      snippet: row.snippet,
      rank: Number(row.rank),
      thumbnailUrl: row.thumbnailUrl,
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  /* ---------------------------- Organization entities ------------------------ */

  /** Campaigns/templates/snippets are small, name-based lookups — Prisma's query builder is fine. */
  private async searchOrganization(
    query: SearchQuery,
    term: string,
    types: string[],
  ): Promise<SearchHit[]> {
    const contains = term ? { contains: term, mode: "insensitive" as const } : undefined;
    const hits: SearchHit[] = [];

    if (types.includes("campaign")) {
      const campaigns = await this.prisma.campaign.findMany({
        where: {
          workspaceId: query.workspaceId,
          deletedAt: null,
          ...(contains ? { OR: [{ name: contains }, { description: contains }] } : {}),
        },
        take: query.limit,
        orderBy: { updatedAt: "desc" },
      });
      hits.push(
        ...campaigns.map((c) => ({
          type: "campaign" as const,
          id: c.id,
          title: c.name,
          snippet: c.description ?? c.goal ?? "",
          rank: term ? 0.5 : 0,
          updatedAt: c.updatedAt.toISOString(),
        })),
      );
    }

    if (types.includes("template")) {
      const templates = await this.prisma.postTemplate.findMany({
        where: {
          workspaceId: query.workspaceId,
          deletedAt: null,
          ...(contains ? { OR: [{ name: contains }, { content: contains }] } : {}),
        },
        take: query.limit,
        orderBy: { updatedAt: "desc" },
      });
      hits.push(
        ...templates.map((t) => ({
          type: "template" as const,
          id: t.id,
          title: t.name,
          snippet: t.content.slice(0, 160),
          rank: term ? 0.5 : 0,
          updatedAt: t.updatedAt.toISOString(),
        })),
      );
    }

    if (types.includes("snippet")) {
      const snippets = await this.prisma.snippet.findMany({
        where: {
          workspaceId: query.workspaceId,
          ...(contains ? { OR: [{ name: contains }, { body: contains }] } : {}),
        },
        take: query.limit,
        orderBy: { updatedAt: "desc" },
      });
      hits.push(
        ...snippets.map((s) => ({
          type: "snippet" as const,
          id: s.id,
          title: s.name,
          snippet: s.body.slice(0, 160),
          rank: term ? 0.5 : 0,
          updatedAt: s.updatedAt.toISOString(),
        })),
      );
    }

    return hits;
  }

  /* ---------------------------------- Facets -------------------------------- */

  /** Counts for the filter rail. Deliberately unfiltered by `q` so the numbers don't collapse to
   *  zero as the user types — they describe the workspace, not the current result set. */
  private async facets(query: SearchQuery): Promise<SearchFacets> {
    const [statusCounts, tags, campaigns] = await Promise.all([
      this.prisma.post.groupBy({
        by: ["status"],
        where: { workspaceId: query.workspaceId, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.tag.findMany({
        where: { workspaceId: query.workspaceId },
        include: { _count: { select: { posts: true } } },
        orderBy: { name: "asc" },
      }),
      this.prisma.campaign.findMany({
        where: { workspaceId: query.workspaceId, deletedAt: null },
        include: { _count: { select: { posts: { where: { deletedAt: null } } } } },
        orderBy: { name: "asc" },
      }),
    ]);

    return {
      status: statusCounts.map((s) => ({ value: s.status, count: s._count._all })),
      tags: tags.map((t) => ({ id: t.id, name: t.name, count: t._count.posts })),
      campaigns: campaigns.map((c) => ({ id: c.id, name: c.name, count: c._count.posts })),
    };
  }
}
