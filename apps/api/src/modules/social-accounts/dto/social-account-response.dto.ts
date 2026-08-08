import { ApiProperty } from "@nestjs/swagger";
import { SocialAccountStatus, SocialPlatform } from "@prisma/client";

export class SocialAccountResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: SocialPlatform }) platform!: SocialPlatform;
  @ApiProperty() externalAccountId!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ required: false, nullable: true }) handle!: string | null;
  @ApiProperty({ required: false, nullable: true }) avatarUrl!: string | null;
  @ApiProperty({ enum: SocialAccountStatus }) status!: SocialAccountStatus;
  @ApiProperty({ required: false, nullable: true }) tokenExpiresAt!: Date | null;
  @ApiProperty({ type: [String] }) scopes!: string[];
  @ApiProperty() connectedById!: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class AuthorizationUrlResponseDto {
  @ApiProperty() url!: string;
}
