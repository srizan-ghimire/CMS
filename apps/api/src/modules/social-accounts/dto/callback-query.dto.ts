import { IsOptional, IsString } from "class-validator";

export class CallbackQueryDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  state!: string;

  // Present when the user clicks "Cancel" on the provider's consent screen instead of
  // authorizing — Facebook sends `error`/`error_description`, TikTok sends `error`/`error_description` too.
  @IsOptional()
  @IsString()
  error?: string;

  @IsOptional()
  @IsString()
  error_description?: string;
}
