import { WorkspaceRole } from "@prisma/client";
import {
  APPROVAL_ROLES,
  CONTENT_CREATE_ROLES,
  CONTENT_MANAGE_ROLES,
  DESTRUCTIVE_ROLES,
  ROLE_RANK,
  VIEW_ROLES,
  atLeast,
} from "./roles";

describe("atLeast", () => {
  it("includes the named role and everything above it", () => {
    expect(atLeast(WorkspaceRole.MANAGER)).toEqual([
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.MANAGER,
    ]);
  });

  it("returns only OWNER for the top of the hierarchy", () => {
    expect(atLeast(WorkspaceRole.OWNER)).toEqual([WorkspaceRole.OWNER]);
  });

  it("returns every role for the bottom", () => {
    expect(atLeast(WorkspaceRole.VIEWER)).toHaveLength(ROLE_RANK.length);
  });
});

describe("capability sets", () => {
  it("lets every role read", () => {
    expect(VIEW_ROLES).toHaveLength(5);
  });

  it("excludes VIEWER from creating content", () => {
    expect(CONTENT_CREATE_ROLES).not.toContain(WorkspaceRole.VIEWER);
    expect(CONTENT_CREATE_ROLES).toContain(WorkspaceRole.EDITOR);
  });

  it("excludes EDITOR from managing others' content", () => {
    expect(CONTENT_MANAGE_ROLES).not.toContain(WorkspaceRole.EDITOR);
  });

  it("restricts approval to MANAGER and above", () => {
    expect(APPROVAL_ROLES).toEqual([
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.MANAGER,
    ]);
  });

  it("restricts destructive actions to ADMIN and above", () => {
    expect(DESTRUCTIVE_ROLES).toEqual([WorkspaceRole.OWNER, WorkspaceRole.ADMIN]);
  });

  it("keeps every capability set a subset of the full hierarchy", () => {
    for (const set of [VIEW_ROLES, CONTENT_CREATE_ROLES, CONTENT_MANAGE_ROLES, DESTRUCTIVE_ROLES]) {
      for (const role of set) expect(ROLE_RANK).toContain(role);
    }
  });
});
