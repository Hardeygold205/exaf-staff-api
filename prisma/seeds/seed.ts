import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const PERMISSIONS: { key: string; description: string }[] = [
  {
    key: "organizations:manage",
    description: "Platform: view and suspend organizations",
  },
  {
    key: "departments:view",
    description: "View departments in the organization",
  },
  { key: "departments:manage", description: "Create and edit departments" },
  { key: "branches:view", description: "View office branches" },
  { key: "branches:manage", description: "Create and edit office branches" },
  {
    key: "invitations:manage",
    description: "Invite and cancel organization members",
  },
  { key: "users:create", description: "Create staff accounts" },
  { key: "users:view", description: "View the staff directory" },
  { key: "users:manage", description: "Update and deactivate staff accounts" },
  {
    key: "users:manage_permissions",
    description: "Grant or revoke direct permissions",
  },
  { key: "users:assign_roles", description: "Assign roles to staff" },
  { key: "users:reset_password", description: "Reset a staff password" },
  { key: "roles:view", description: "View roles and permissions" },
  { key: "roles:manage", description: "Create roles and attach permissions" },
  {
    key: "attendance:manage_exemption",
    description: "Exempt staff from attendance",
  },
  { key: "attendance:view_all", description: "View attendance for all staff" },
  { key: "attendance:export", description: "Export attendance reports" },
  { key: "attendance:review", description: "Review staff attendance" },
  { key: "projects:create", description: "Create new projects" },
  {
    key: "projects:update",
    description: "Edit project details and visibility",
  },
  { key: "projects:update_status", description: "Change project status" },
  {
    key: "projects:manage_members",
    description: "Invite or remove project members",
  },
  { key: "projects:delete", description: "Delete or archive projects" },
  { key: "tasks:create", description: "Create tasks within a project" },
  { key: "tasks:assign", description: "Assign tasks to other staff members" },
  { key: "tasks:update_status", description: "Update the status of own tasks" },
  { key: "tasks:manage_status", description: "Update the status of any task" },
  { key: "tasks:manage", description: "Edit or manage any task" },
  { key: "tasks:edit", description: "Edit task details and descriptions" },
  { key: "tasks:delete", description: "Delete tasks" },
  {
    key: "requests:view_all",
    description: "View staff requests for all employees",
  },
  { key: "requests:approve", description: "Approve or reject staff requests" },
  {
    key: "screentime:view_all",
    description: "View screentime and app usage for all staff",
  },
  {
    key: "activities:view_all",
    description: "View activity audit logs for all staff",
  },
  { key: "uploads:create", description: "Upload files and attach media" },
  {
    key: "uploads:view_all",
    description: "View all uploaded files in the organization",
  },
  {
    key: "uploads:manage",
    description: "Delete or re-organize uploaded files",
  },
  {
    key: "events:manage",
    description: "Create and manage organization events",
  },
  {
    key: "suggestions:manage",
    description: "Review and update staff suggestions",
  },
];

async function main() {
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: permission,
    });
  }

  const email = process.env.PLATFORM_ADMIN_EMAIL;
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn(
      "PLATFORM_ADMIN_EMAIL / PLATFORM_ADMIN_PASSWORD not set — skipping platform admin creation.",
    );
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: { isPlatformAdmin: true, isActive: true, organizationId: null },
    create: {
      email,
      passwordHash,
      firstName: process.env.PLATFORM_ADMIN_FIRST_NAME ?? "Platform",
      lastName: process.env.PLATFORM_ADMIN_LAST_NAME ?? "Admin",
      position: "Platform Admin",
      isPlatformAdmin: true,
      mustChangePassword: true,
      organizationId: null,
    },
    
  });

  console.log(`Seeded permissions and platform admin ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
