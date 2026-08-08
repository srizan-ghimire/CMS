import "dotenv/config";
import { createCipheriv, randomBytes } from "crypto";
import { PrismaClient } from "@prisma/client";
import { auth } from "../src/modules/auth/lib/auth";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@socialplatform.dev";
const DEMO_PASSWORD = "DemoPassword123";

async function seedPlansAndFlags() {
  const [free, pro] = await Promise.all([
    prisma.plan.upsert({
      where: { name: "Free" },
      update: {},
      create: { name: "Free", priceMonthly: 0, postLimit: 30, seatLimit: 1, socialLimit: 3 },
    }),
    prisma.plan.upsert({
      where: { name: "Pro" },
      update: {},
      create: { name: "Pro", priceMonthly: 2900, postLimit: 500, seatLimit: 10, socialLimit: 15 },
    }),
  ]);

  await prisma.featureFlag.upsert({
    where: { key: "ai_agents" },
    update: {},
    create: { key: "ai_agents", enabled: false, rolloutPercentage: 0 },
  });

  return { free, pro };
}

// Creates the demo user through Better Auth's own signup endpoint rather than inserting a
// row directly — that's the only way to get a password hash in the exact format Better Auth's
// credential provider expects. If the user already exists (re-running the seed), we just look
// it up instead of failing.
async function seedDemoUser() {
  let user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });

  if (!user) {
    const result = await auth.api.signUpEmail({
      body: { name: "Demo User", email: DEMO_EMAIL, password: DEMO_PASSWORD },
    });
    user = await prisma.user.findUniqueOrThrow({ where: { id: result.user.id } });
  }

  // Bypass requireEmailVerification for the seeded account so `pnpm dev` gives you something
  // you can log into immediately, without digging a link out of Mailhog.
  if (!user.emailVerified) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });
  }

  return user;
}

async function seedDemoWorkspace(ownerId: string, proPlanId: string) {
  const existing = await prisma.workspace.findUnique({ where: { slug: "demo" } });
  if (existing) return existing;

  return prisma.workspace.create({
    data: {
      name: "Demo Workspace",
      slug: "demo",
      ownerId,
      planId: proPlanId,
      members: {
        create: { userId: ownerId, role: "OWNER" },
      },
    },
  });
}

/**
 * Encrypts exactly as TokenCryptoService does (`iv:authTag:ciphertext`, hex). Duplicated rather
 * than imported because the seed runs through ts-node without the Nest DI container, and the
 * service reads its key from ConfigService.
 */
function encryptToken(plaintext: string): string {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string to seed social accounts.");
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(hex, "hex"), iv, { authTagLength: 16 });
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [iv.toString("hex"), cipher.getAuthTag().toString("hex"), encrypted.toString("hex")].join(
    ":",
  );
}

/**
 * Demo social accounts so the composer, calendar and publish pipeline are all usable without
 * real Meta/TikTok credentials. The tokens are deliberately fake — publishing against these
 * accounts routes to the stub publisher (which is selected whenever MEDIA_PUBLIC_BASE_URL is
 * unset), so nothing is ever sent to a real platform.
 */
async function seedDemoSocialAccounts(workspaceId: string, userId: string) {
  const accounts = [
    {
      platform: "FACEBOOK" as const,
      externalAccountId: "demo-fb-page-1",
      displayName: "Demo Coffee Co. (Page)",
      handle: "democoffee",
      metadata: { category: "Coffee shop", tasks: ["CREATE_CONTENT", "MANAGE"] },
    },
    {
      platform: "INSTAGRAM" as const,
      externalAccountId: "demo-ig-1",
      displayName: "Demo Coffee Co.",
      handle: "democoffee",
      // Mirrors what FacebookProvider stores: Instagram publishes with its parent Page's token.
      metadata: { linkedFacebookPageId: "demo-fb-page-1" },
    },
    {
      platform: "TIKTOK" as const,
      externalAccountId: "demo-tt-1",
      displayName: "Demo Coffee",
      handle: "democoffee",
      metadata: {},
    },
  ];

  for (const account of accounts) {
    await prisma.socialAccount.upsert({
      where: {
        workspaceId_platform_externalAccountId: {
          workspaceId,
          platform: account.platform,
          externalAccountId: account.externalAccountId,
        },
      },
      create: {
        workspaceId,
        platform: account.platform,
        externalAccountId: account.externalAccountId,
        displayName: account.displayName,
        handle: account.handle,
        status: "CONNECTED",
        encryptedAccessToken: encryptToken(`demo-token-${account.externalAccountId}`),
        // null == "no scheduled expiry", which also excludes these from the refresh sweep so the
        // seeded accounts never get flipped to TOKEN_EXPIRED by a background job.
        tokenExpiresAt: null,
        scopes: ["demo"],
        metadata: account.metadata,
        connectedById: userId,
        lastValidatedAt: new Date(),
      },
      update: { status: "CONNECTED", lastErrorMessage: null },
    });
  }

  return prisma.socialAccount.findMany({ where: { workspaceId } });
}

async function main() {
  const { pro } = await seedPlansAndFlags();
  const demoUser = await seedDemoUser();
  const workspace = await seedDemoWorkspace(demoUser.id, pro.id);
  const accounts = await seedDemoSocialAccounts(workspace.id, demoUser.id);

  console.log("Seed complete.");
  console.log(`  Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  Demo social accounts: ${accounts.map((a) => a.platform).join(", ")} (fake tokens)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
