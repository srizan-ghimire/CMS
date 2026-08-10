import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { NotificationType, WorkspaceRole } from "@prisma/client";
import type {
  CreateWorkspaceInput,
  InviteMemberInput,
  UpdateMemberRoleInput,
  UpdateWorkspaceInput,
  WorkspaceInvitationDto,
  WorkspaceMemberDto,
} from "@social-platform/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { sendMail } from "../auth/lib/email";

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  role: WorkspaceRole;
}

const ADMIN_ROLES: WorkspaceRole[] = [WorkspaceRole.OWNER, WorkspaceRole.ADMIN];
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string): Promise<WorkspaceSummary[]> {
    const [owned, memberships] = await Promise.all([
      this.prisma.workspace.findMany({
        where: { ownerId: userId, deletedAt: null },
        select: { id: true, name: true, slug: true, logoUrl: true },
      }),
      this.prisma.workspaceMember.findMany({
        where: { userId, workspace: { deletedAt: null } },
        select: {
          role: true,
          workspace: { select: { id: true, name: true, slug: true, logoUrl: true } },
        },
      }),
    ]);

    const byId = new Map<string, WorkspaceSummary>();
    for (const w of owned) {
      byId.set(w.id, { ...w, role: WorkspaceRole.OWNER });
    }
    for (const m of memberships) {
      if (!byId.has(m.workspace.id)) {
        byId.set(m.workspace.id, { ...m.workspace, role: m.role });
      }
    }
    return Array.from(byId.values());
  }

  /**
   * The authorization primitive every workspace-scoped service calls before touching a row.
   * Returns the caller's effective role so callers can vary behaviour by role (e.g. an EDITOR may
   * edit only their own drafts) without a second query.
   *
   * `Workspace.ownerId` is treated as an implicit OWNER — the owner is not required to also have a
   * `WorkspaceMember` row, and the seed does not create one.
   *
   * Throws NotFound for a missing/soft-deleted workspace, and NotFound (not Forbidden) is
   * deliberate there: a non-member must not be able to distinguish "exists" from "doesn't".
   */
  async assertMembership(
    workspaceId: string,
    userId: string,
    allowedRoles?: WorkspaceRole[],
  ): Promise<WorkspaceRole> {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      select: { ownerId: true },
    });
    if (!workspace) {
      throw new NotFoundException("Workspace not found.");
    }

    let role: WorkspaceRole | undefined;
    if (workspace.ownerId === userId) {
      role = WorkspaceRole.OWNER;
    } else {
      const membership = await this.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
        select: { role: true },
      });
      role = membership?.role;
    }

    if (!role) {
      throw new ForbiddenException("You are not a member of this workspace.");
    }
    if (allowedRoles && !allowedRoles.includes(role)) {
      throw new ForbiddenException(
        `Your role (${role.toLowerCase()}) does not permit this action in this workspace.`,
      );
    }
    return role;
  }

  /* ---------------------------------- CRUD ---------------------------------- */

  async create(input: CreateWorkspaceInput, userId: string): Promise<WorkspaceSummary> {
    const slug = await this.uniqueSlug(input.slug ?? slugify(input.name));

    const workspace = await this.prisma.workspace.create({
      data: {
        name: input.name,
        slug,
        ownerId: userId,
        // The owner is already an implicit OWNER via assertMembership, but a real row makes the
        // member list complete so "who is in this workspace" is one query.
        members: { create: { userId, role: WorkspaceRole.OWNER } },
      },
    });

    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      logoUrl: workspace.logoUrl,
      role: WorkspaceRole.OWNER,
    };
  }

  async update(
    workspaceId: string,
    input: UpdateWorkspaceInput,
    userId: string,
  ): Promise<WorkspaceSummary> {
    const role = await this.assertMembership(workspaceId, userId, ADMIN_ROLES);
    const workspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
      },
    });
    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      logoUrl: workspace.logoUrl,
      role,
    };
  }

  async remove(workspaceId: string, userId: string): Promise<void> {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      select: { ownerId: true },
    });
    if (!workspace) throw new NotFoundException("Workspace not found.");
    // Only the owner may delete. An ADMIN can manage everything inside a workspace but not
    // destroy the container holding other people's work.
    if (workspace.ownerId !== userId) {
      throw new ForbiddenException("Only the workspace owner can delete it.");
    }
    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { deletedAt: new Date() },
    });
  }

  /* --------------------------------- Members -------------------------------- */

  async listMembers(workspaceId: string, userId: string): Promise<WorkspaceMemberDto[]> {
    await this.assertMembership(workspaceId, userId);
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: {
        ownerId: true,
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    return workspace.members.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      isOwner: m.userId === workspace.ownerId,
      joinedAt: m.joinedAt.toISOString(),
    }));
  }

  async updateMemberRole(
    workspaceId: string,
    memberUserId: string,
    input: UpdateMemberRoleInput,
    userId: string,
  ): Promise<void> {
    await this.assertMembership(workspaceId, userId, ADMIN_ROLES);
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { ownerId: true },
    });
    // Demoting the owner would leave nobody able to delete the workspace.
    if (workspace.ownerId === memberUserId) {
      throw new BadRequestException("The workspace owner's role cannot be changed.");
    }

    const result = await this.prisma.workspaceMember.updateMany({
      where: { workspaceId, userId: memberUserId },
      data: { role: input.role as WorkspaceRole },
    });
    if (result.count === 0) throw new NotFoundException("Member not found in this workspace.");
  }

  async removeMember(workspaceId: string, memberUserId: string, userId: string): Promise<void> {
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { ownerId: true },
    });
    if (workspace.ownerId === memberUserId) {
      throw new BadRequestException("The workspace owner cannot be removed.");
    }
    // Anyone may remove themselves; removing someone else needs ADMIN+.
    await this.assertMembership(
      workspaceId,
      userId,
      memberUserId === userId ? undefined : ADMIN_ROLES,
    );

    await this.prisma.workspaceMember.deleteMany({ where: { workspaceId, userId: memberUserId } });
  }

  /* ------------------------------- Invitations ------------------------------- */

  async listInvitations(workspaceId: string, userId: string): Promise<WorkspaceInvitationDto[]> {
    await this.assertMembership(workspaceId, userId, ADMIN_ROLES);
    const invitations = await this.prisma.workspaceInvitation.findMany({
      where: { workspaceId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    return invitations.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      expiresAt: i.expiresAt.toISOString(),
      createdAt: i.createdAt.toISOString(),
    }));
  }

  async invite(
    workspaceId: string,
    input: InviteMemberInput,
    userId: string,
  ): Promise<WorkspaceInvitationDto> {
    await this.assertMembership(workspaceId, userId, ADMIN_ROLES);

    const email = input.email.toLowerCase();

    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { name: true, ownerId: true },
    });

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      // The owner is an implicit OWNER without a WorkspaceMember row (see assertMembership), so a
      // membership lookup alone does not see them. Without this, an owner could be invited to
      // their own workspace and, on accepting, gain a real member row at a *lower* role than the
      // ownership they already hold — two disagreeing sources of authority for one person.
      if (existingUser.id === workspace.ownerId) {
        throw new ConflictException("That person owns this workspace.");
      }
      const already = await this.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: existingUser.id } },
      });
      if (already) throw new ConflictException("That person is already a member.");
    }

    // Upsert so re-inviting the same address refreshes the token instead of colliding on the
    // (workspaceId, email) unique constraint.
    const invitation = await this.prisma.workspaceInvitation.upsert({
      where: { workspaceId_email: { workspaceId, email } },
      create: {
        workspaceId,
        email,
        role: input.role as WorkspaceRole,
        invitedById: userId,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
      update: {
        role: input.role as WorkspaceRole,
        invitedById: userId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    });

    const url = `${process.env.WEB_URL ?? "http://localhost:3000"}/invite/${invitation.token}`;
    try {
      await sendMail({
        to: email,
        subject: `You have been invited to ${workspace.name}`,
        html: `<p>You have been invited to join <strong>${workspace.name}</strong> on Social Platform.</p>
               <p><a href="${url}">Accept the invitation</a> — this link expires in 7 days.</p>`,
      });
    } catch (err) {
      // The row is the source of truth; a mail outage must not lose the invitation. The link can
      // always be re-sent from the members screen.
      this.logger.warn(`Invitation email to ${email} failed: ${String(err)}`);
    }

    if (existingUser) {
      await this.prisma.notification.create({
        data: {
          workspaceId,
          userId: existingUser.id,
          type: NotificationType.WORKSPACE_INVITE,
          title: `Invitation to ${workspace.name}`,
          body: `You have been invited to join ${workspace.name} as ${input.role.toLowerCase()}.`,
        },
      });
    }

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
    };
  }

  async revokeInvitation(invitationId: string, userId: string): Promise<void> {
    const invitation = await this.prisma.workspaceInvitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation) throw new NotFoundException("Invitation not found.");
    await this.assertMembership(invitation.workspaceId, userId, ADMIN_ROLES);
    await this.prisma.workspaceInvitation.update({
      where: { id: invitationId },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Accepting requires a signed-in user whose email matches the invited address. An invitation is
   * addressed to a person, not a bearer token for whoever happens to hold the link.
   */
  async acceptInvitation(token: string, userId: string): Promise<WorkspaceSummary> {
    const invitation = await this.prisma.workspaceInvitation.findUnique({ where: { token } });
    if (!invitation || invitation.revokedAt || invitation.acceptedAt) {
      throw new NotFoundException("This invitation is no longer valid.");
    }
    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException("This invitation has expired.");
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new ForbiddenException("This invitation was sent to a different email address.");
    }

    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: invitation.workspaceId },
    });

    await this.prisma.$transaction([
      this.prisma.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId } },
        create: {
          workspaceId: invitation.workspaceId,
          userId,
          role: invitation.role,
          invitedBy: invitation.invitedById,
        },
        update: { role: invitation.role },
      }),
      this.prisma.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      }),
    ]);

    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      logoUrl: workspace.logoUrl,
      role: invitation.role,
    };
  }

  /* -------------------------------- Internals ------------------------------- */

  private async uniqueSlug(base: string): Promise<string> {
    const root = base || "workspace";
    for (let i = 0; i < 50; i++) {
      const candidate = i === 0 ? root : `${root}-${i}`;
      const clash = await this.prisma.workspace.findUnique({ where: { slug: candidate } });
      if (!clash) return candidate;
    }
    // Practically unreachable, but a timestamp suffix is better than looping forever.
    return `${root}-${Date.now().toString(36)}`;
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
