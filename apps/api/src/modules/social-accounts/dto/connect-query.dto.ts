import { IsOptional, IsString, Matches } from "class-validator";

export class ConnectQueryDto {
  @IsString()
  workspaceId!: string;

  // Restricted to an in-app path (no scheme/host) so this can never be turned into an open
  // redirect — the callback controller appends it to WEB_URL itself.
  @IsOptional()
  @IsString()
  @Matches(/^\/[a-zA-Z0-9\-/_?=&]*$/, {
    message: "redirectPath must be a relative in-app path",
  })
  redirectPath?: string;
}
