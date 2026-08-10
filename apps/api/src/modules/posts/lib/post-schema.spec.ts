import { createPostSchema, updatePostSchema, isPostEditable, PostStatus } from "@social-platform/shared";

/**
 * These guard two defects that reached the client as opaque 500s rather than as anything
 * actionable, both because a rule lived in only one of the two places that needed it.
 */

const CUID_A = "clm0000000000000000000001";
const CUID_B = "clm0000000000000000000002";
const WORKSPACE = "clm0000000000000000000003";

describe("post input schemas reject duplicate ids", () => {
  // PostMedia and PostTarget both carry a composite unique constraint, so a repeated id reaches
  // Postgres as a duplicate key. Validation has to catch it or P2002 becomes a 500.
  it("rejects the same media asset twice on create", () => {
    const result = createPostSchema.safeParse({
      workspaceId: WORKSPACE,
      mediaAssetIds: [CUID_A, CUID_A],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/cannot be attached twice/i);
    }
  });

  it("rejects the same account targeted twice on create", () => {
    const result = createPostSchema.safeParse({
      workspaceId: WORKSPACE,
      targets: [{ socialAccountId: CUID_A }, { socialAccountId: CUID_A }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/cannot be targeted twice/i);
    }
  });

  // The composer autosaves through the update schema, so the same rule has to hold on both.
  it("rejects duplicates on update as well as create", () => {
    expect(updatePostSchema.safeParse({ mediaAssetIds: [CUID_A, CUID_A] }).success).toBe(false);
    expect(
      updatePostSchema.safeParse({
        targets: [{ socialAccountId: CUID_B }, { socialAccountId: CUID_B }],
      }).success,
    ).toBe(false);
  });

  it("accepts distinct ids", () => {
    const result = createPostSchema.safeParse({
      workspaceId: WORKSPACE,
      mediaAssetIds: [CUID_A, CUID_B],
      targets: [{ socialAccountId: CUID_A }, { socialAccountId: CUID_B }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty array", () => {
    expect(createPostSchema.safeParse({ workspaceId: WORKSPACE }).success).toBe(true);
  });
});

describe("isPostEditable covers every already-delivered state", () => {
  // SchedulingService.reschedule used to name PUBLISHED and PUBLISHING by hand and miss
  // PARTIALLY_PUBLISHED, so a post that had gone out to some networks could be dragged to a new
  // date — resetting its status and its targets, and rewriting a delivery record that had really
  // happened. Both sides now call this helper; this asserts what it must keep covering.
  it.each([PostStatus.PUBLISHING, PostStatus.PUBLISHED, PostStatus.PARTIALLY_PUBLISHED])(
    "locks %s",
    (status) => {
      expect(isPostEditable(status)).toBe(false);
    },
  );

  it.each([
    PostStatus.DRAFT,
    PostStatus.PENDING_APPROVAL,
    PostStatus.SCHEDULED,
    PostStatus.FAILED,
    PostStatus.CANCELLED,
  ])("leaves %s editable", (status) => {
    expect(isPostEditable(status)).toBe(true);
  });
});
