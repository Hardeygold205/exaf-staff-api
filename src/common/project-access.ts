import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../infra/prisma/prisma.service";
import { AuthUser } from "./decorators/current-user.decorator";
import { assertSameOrg } from "./tenant";

export type ProjectAccessMode = "view" | "manage";

export async function loadAccessibleProject(
  prisma: PrismaService,
  actor: AuthUser,
  projectId: string,
  mode: ProjectAccessMode = "view",
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: { select: { userId: true, role: true } },
      department: { select: { id: true, name: true } },
    },
  });
  if (!project) throw new NotFoundException("Project not found");
  assertSameOrg(actor, project.organizationId);

  if (actor.isPlatformAdmin) return project;

  const membership = project.members.find((member) => member.userId === actor.id);
  const isCreator = project.createdById === actor.id;
  const canManage =
    isCreator ||
    membership?.role === "OWNER" ||
    membership?.role === "MANAGER" ||
    actor.permissions.includes("projects:manage_members") ||
    actor.permissions.includes("projects:update");

  if (mode === "manage") {
    if (!canManage) {
      throw new ForbiddenException("You cannot manage this project");
    }
    return project;
  }

  if (project.visibility === "PUBLIC" || isCreator || membership) return project;

  if (project.visibility === "DEPARTMENT" && project.departmentId) {
    const user = await prisma.user.findUnique({
      where: { id: actor.id },
      select: { departmentId: true },
    });
    if (user?.departmentId && user.departmentId === project.departmentId) {
      return project;
    }
  }

  throw new ForbiddenException("You cannot view this project");
}
