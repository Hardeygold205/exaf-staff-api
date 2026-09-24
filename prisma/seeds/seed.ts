import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as bcrypt from "bcrypt";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PERMISSIONS = [
  { key: "users:create", description: "Create staff accounts" },
  { key: "users:view", description: "View the staff directory" },
  {
    key: "users:manage",
    description: "Deactivate, edit, or manage staff accounts",
  },
  {
    key: "users:manage_permissions",
    description: "Give or revoke staff permission",
  },
  {
    key: "users:assign_roles",
    description: "Assign non-privileged roles to staff accounts",
  },

  {
    key: "users:reset_password",
    description: "Reset passwords for staff accounts",
  },

  // Roles & Access Control
  { key: "roles:view", description: "View roles and permissions" },
  { key: "roles:manage", description: "Create roles and attach permissions" },

  // Attendance & Time Tracking
  {
    key: "attendance:manage_exemption",
    description:
      "Exempt a user from daily check-in/check-out — they count as present automatically",
  },
  {
    key: "attendance:view_all",
    description: "View attendance records for all staff",
  },
  { key: "attendance:export", description: "Export attendance reports" },
  { key: "attendance:review", description: "Review staff attendance" },

  // Projects Management
  { key: "projects:create", description: "Create new projects" },
  {
    key: "projects:update",
    description: "Edit project details and assign members",
  },
  { key: "projects:update_status", description: "Change project status" },
  {
    key: "projects:manage_members",
    description: "Add or remove staff members from projects",
  },
  { key: "projects:delete", description: "Delete or archive projects" },

  // Tasks Management
  { key: "tasks:create", description: "Create tasks within a project" },
  { key: "tasks:assign", description: "Assign tasks to other staff members" },
  {
    key: "tasks:update_status",
    description: "Update task progress and status",
  },
  { key: "tasks:manage_status", description: "Update the status of any task" },
  { key: "tasks:manage", description: "Edit or manage any task" },
  { key: "tasks:edit", description: "Edit task details and descriptions" },
  { key: "tasks:delete", description: "Delete tasks" },

  // Staff Requests (Leave, Expenses, Reimbursements)
  {
    key: "requests:view_all",
    description: "View staff requests for all employees",
  },
  { key: "requests:approve", description: "Approve or reject staff requests" },

  // Monitoring & Analytics
  {
    key: "screentime:view_all",
    description: "View screentime and app usage for all staff",
  },
  {
    key: "activities:view_all",
    description: "View activity audit logs for all staff",
  },

  // File & Document Storage
  {
    key: "uploads:create",
    description:
      "Upload files and attach media to tasks, projects, or requests",
  },
  {
    key: "uploads:view_all",
    description: "View all uploaded files across the company",
  },
  {
    key: "uploads:manage",
    description: "Delete or re-organize any uploaded file",
  },

  // Events, announcements & birthdays
  {
    key: "events:manage",
    description: "Create, edit, and delete workplace events and announcements",
  },
  {
    key: "events:manage",
    description: "Create and manage company events and public holidays",
  },
  {
    key: "suggestions:manage",
    description: "Review and update staff suggestions",
  },
];

const ALL_KEYS = PERMISSIONS.map((p) => p.key);

const executiveVisibility = [
  "users:view",
  "roles:view",
  "users:manage_permissions",
  "attendance:view_all",
  "attendance:export",
  "attendance:review",
  "requests:view_all",
  "requests:approve",
  "screentime:view_all",
  "activities:view_all",
  "uploads:view_all",
];

const ROLES: Record<string, { description: string; permissions: string[] }> = {
  SUPERADMIN: {
    description: "Full system administration",
    permissions: ALL_KEYS,
  },
  CEO: {
    description: "Executive visibility & request approvals",
    permissions: [...executiveVisibility, "uploads:create"],
  },
  COO: {
    description: "Operations executive oversight",
    permissions: [...executiveVisibility, "uploads:create"],
  },
  HR: {
    description: "People operations & staff administration",
    permissions: [
      "users:create",
      "users:view",
      "users:manage",
      "users:manage_permissions",
      "users:assign_roles",
      "roles:view",
      "attendance:view_all",
      "attendance:export",
      "attendance:review",
      "requests:view_all",
      "requests:approve",
      "uploads:create",
      "uploads:view_all",
      "uploads:manage",
      "events:manage",
      "suggestions:manage",
    ],
  },
  TECH_LEAD: {
    description: "Engineering team leadership & project delivery",
    permissions: [
      "users:view",
      "users:create",
      "users:reset_password",
      "users:manage_permissions",
      "attendance:view_all",
      "attendance:review",
      "projects:create",
      "projects:update",
      "projects:manage_members",
      "projects:update_status",
      "tasks:create",
      "tasks:assign",
      "tasks:update_status",
      "tasks:manage_status",
      "tasks:manage",
      "tasks:edit",
      "tasks:delete",
      "uploads:create",
    ],
  },
  FINANCE_LEAD: {
    description: "Financial request approvals & organizational visibility",
    permissions: [
      "users:view",
      "attendance:view_all",
      "attendance:review",
      "attendance:export",
      "requests:view_all",
      "requests:approve",
      "uploads:create",
    ],
  },
  OPERATION_LEAD: {
    description: "Daily operational workflows & project tracking",
    permissions: [
      "users:view",
      "attendance:view_all",
      "attendance:review",
      "projects:create",
      "projects:update",
      "projects:manage_members",
      "projects:update_status",
      "tasks:create",
      "tasks:assign",
      "tasks:update_status",
      "tasks:manage_status",
      "tasks:manage",
      "tasks:edit",
      "requests:view_all",
      "uploads:create",
    ],
  },
  STAFF: {
    description: "Standard employee access for daily task delivery",
    permissions: [
      "users:view",
      "projects:create",
      "projects:update_status",
      "tasks:create",
      "tasks:update_status",
      "tasks:edit",
      "uploads:create",
    ],
  },
};

async function main() {
  console.log("Seeding permissions...");
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: { description: perm.description },
      create: perm,
    });
  }

  console.log("Seeding roles...");
  for (const [roleName, spec] of Object.entries(ROLES)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: { description: spec.description },
      create: { name: roleName, description: spec.description },
    });

    const permissions = await prisma.permission.findMany({
      where: { key: { in: spec.permissions } },
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (permissions.length) {
      await prisma.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      });
    }
  }

  const superadminEmail = process.env.SEED_SUPERADMIN_EMAIL;
  const superadminPassword = process.env.SEED_SUPERADMIN_PASSWORD;

  if (!superadminEmail || !superadminPassword) {
    console.warn(
      "SEED_SUPERADMIN_EMAIL / SEED_SUPERADMIN_PASSWORD not set — skipping superadmin creation.",
    );
    return;
  }

  const existing = await prisma.user.findUnique({
    where: { email: superadminEmail.toLowerCase() },
  });
  if (existing) {
    console.log(`Superadmin ${superadminEmail} already exists — skipping.`);
    return;
  }

  console.log(`Creating superadmin ${superadminEmail}...`);
  const superadminRole = await prisma.role.findUniqueOrThrow({
    where: { name: "SUPERADMIN" },
  });
  const passwordHash = await bcrypt.hash(superadminPassword, 12);

  await prisma.user.create({
    data: {
      email: superadminEmail.toLowerCase(),
      firstName: "Super",
      lastName: "Admin",
      passwordHash,
      mustChangePassword: false,
      roles: { create: [{ roleId: superadminRole.id }] },
    },
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
