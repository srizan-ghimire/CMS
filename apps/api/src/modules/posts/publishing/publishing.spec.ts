import { SocialPlatform } from "@prisma/client";
import { PLATFORM_LIMITS, validateAgainstPlatform } from "@social-platform/shared";
import { StubPublisher } from "./providers/stub.publisher";
import { PublishError } from "./interfaces/publish-provider.interface";
import type { PublishRequest } from "./interfaces/publish-provider.interface";

function request(overrides: Partial<PublishRequest> = {}): PublishRequest {
  return {
    target: { id: "t1", idempotencyKey: "key1", containerId: null, attempts: 0 },
    account: {
      platform: SocialPlatform.FACEBOOK,
      externalAccountId: "acct",
      accessToken: "secret",
      metadata: null,
    },
    content: "hello",
    firstComment: null,
    media: [],
    options: {},
    scheduledAt: null,
    ...overrides,
  };
}

const image = (over: Partial<PublishRequest["media"][number]> = {}) => ({
  assetId: "a1",
  type: "IMAGE" as const,
  mimeType: "image/jpeg",
  publicUrl: "https://cdn.example/a1.jpg",
  storageKey: "k",
  width: 1080,
  height: 1080,
  durationMs: null,
  sizeBytes: 1000,
  altText: null,
  ...over,
});

describe("validateAgainstPlatform", () => {
  it("rejects a caption longer than the platform allows", () => {
    const errors = validateAgainstPlatform(
      SocialPlatform.TWITTER,
      "x".repeat(PLATFORM_LIMITS.TWITTER.maxChars + 1),
      [],
    );
    expect(errors.join(" ")).toMatch(/limit is 280/);
  });

  it("requires media on platforms that do not allow text-only posts", () => {
    expect(validateAgainstPlatform(SocialPlatform.INSTAGRAM, "caption", []).join(" ")).toMatch(
      /at least one image or video/,
    );
    expect(validateAgainstPlatform(SocialPlatform.FACEBOOK, "caption", [])).toHaveLength(0);
  });

  it("rejects an aspect ratio outside Instagram's accepted range", () => {
    const tall = validateAgainstPlatform(SocialPlatform.INSTAGRAM, "c", [
      { type: "IMAGE", sizeBytes: 1000, width: 500, height: 2000, durationMs: null },
    ]);
    expect(tall.join(" ")).toMatch(/aspect ratio/);
  });

  it("accepts a square image on Instagram", () => {
    expect(
      validateAgainstPlatform(SocialPlatform.INSTAGRAM, "c", [
        { type: "IMAGE", sizeBytes: 1000, width: 1080, height: 1080, durationMs: null },
      ]),
    ).toHaveLength(0);
  });

  it("rejects more images than the platform's carousel limit", () => {
    const many = Array.from({ length: 12 }, () => ({
      type: "IMAGE" as const,
      sizeBytes: 100,
      width: 1080,
      height: 1080,
      durationMs: null,
    }));
    expect(validateAgainstPlatform(SocialPlatform.INSTAGRAM, "c", many).join(" ")).toMatch(
      /exceeds the limit of 10/,
    );
  });

  it("rejects a video shorter than the platform's minimum", () => {
    expect(
      validateAgainstPlatform(SocialPlatform.TIKTOK, "c", [
        { type: "VIDEO", sizeBytes: 1000, width: 720, height: 1280, durationMs: 1000 },
      ]).join(" "),
    ).toMatch(/at least 3s/);
  });

  it("rejects mixing images and video where the platform forbids it", () => {
    const errors = validateAgainstPlatform(SocialPlatform.FACEBOOK, "c", [
      { type: "IMAGE", sizeBytes: 100, width: 100, height: 100, durationMs: null },
      { type: "VIDEO", sizeBytes: 100, width: 100, height: 100, durationMs: 5000 },
    ]);
    expect(errors.join(" ")).toMatch(/cannot be combined/);
  });

  it("flags an entirely empty post", () => {
    expect(validateAgainstPlatform(SocialPlatform.FACEBOOK, "   ", []).join(" ")).toMatch(/empty/);
  });
});

describe("StubPublisher", () => {
  const ctx = { saveContainerId: jest.fn(async () => undefined) };
  beforeEach(() => ctx.saveContainerId.mockClear());

  it("publishes and returns a deterministic platform id", async () => {
    const publisher = new StubPublisher(SocialPlatform.FACEBOOK);
    const outcome = await publisher.publish(request({ media: [image()] }), ctx);
    expect(outcome.kind).toBe("PUBLISHED");
    if (outcome.kind === "PUBLISHED") {
      expect(outcome.platformPostId).toBe("stub-facebook-key1");
    }
  });

  it("needs no public media URL, unlike the Meta providers", () => {
    expect(new StubPublisher(SocialPlatform.FACEBOOK).requiresPublicMediaUrls).toBe(false);
  });

  it("returns PENDING and saves a container id when simulating an async platform", async () => {
    const publisher = new StubPublisher(SocialPlatform.INSTAGRAM);
    const outcome = await publisher.publish(
      request({ media: [image()], options: { __stubPending: true } }),
      ctx,
    );
    expect(outcome.kind).toBe("PENDING");
    // Persisting before finalizing is what stops a retry double-posting.
    expect(ctx.saveContainerId).toHaveBeenCalledWith("stub-container-key1");
  });

  it("completes on the follow-up status check", async () => {
    const publisher = new StubPublisher(SocialPlatform.INSTAGRAM);
    const outcome = await publisher.checkStatus(request({ media: [image()] }), "c1");
    expect(outcome.kind).toBe("PUBLISHED");
  });

  it("raises a non-retryable error when told to fail terminally", async () => {
    const publisher = new StubPublisher(SocialPlatform.FACEBOOK);
    await expect(
      publisher.publish(request({ media: [image()], options: { __stubFailTerminally: true } }), ctx),
    ).rejects.toMatchObject({ retryable: false });
  });

  it("propagates platform validation through validate()", () => {
    const publisher = new StubPublisher(SocialPlatform.INSTAGRAM);
    expect(publisher.validate(request({ media: [] })).ok).toBe(false);
    expect(publisher.validate(request({ media: [image()] })).ok).toBe(true);
  });
});

describe("PublishError", () => {
  it("carries retryability and token-invalid separately", () => {
    const err = new PublishError("bad token", false, "190", true);
    expect(err.retryable).toBe(false);
    expect(err.tokenInvalid).toBe(true);
    expect(err.code).toBe("190");
  });

  it("defaults tokenInvalid to false", () => {
    expect(new PublishError("boom", true).tokenInvalid).toBe(false);
  });
});
