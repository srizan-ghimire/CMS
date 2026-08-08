import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

type SessionUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  emailVerified: boolean;
  twoFactorEnabled?: boolean;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // Strips anything we wouldn't want echoed back to the client, even though Better Auth's
  // session payload is already safe (no password hash, no tokens).
  toPublicProfile(user: SessionUser) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image ?? null,
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled ?? false,
    };
  }
}
