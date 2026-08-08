import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { searchQuerySchema, type SearchQuery } from "@social-platform/shared";
import { zodPipe } from "../../common/pipes/zod-validation.pipe";
import { SearchService } from "./search.service";

// The @AllowAnonymous() that used to sit here was removed with the stub: search returns workspace
// content, so it must be behind the global AuthGuard.
@ApiTags("search")
@Controller({ path: "search", version: "1" })
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({
    summary: "Full-text search across posts, media, campaigns, templates and snippets",
    description:
      "`q` is passed to Postgres websearch_to_tsquery, so \"quoted phrases\", -exclusions and OR " +
      "all work. Results are ranked with ts_rank_cd and snippets come from ts_headline.",
  })
  search(@Query(zodPipe(searchQuerySchema)) query: SearchQuery, @Session() session: UserSession) {
    return this.searchService.search(query, session.user.id);
  }
}
