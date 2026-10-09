# Staff Workplace API

Multi-tenant staff workplace API. One deployment serves many organizations. Each company has its own people, departments, branches, roles, projects, and files. Nothing is shared across companies except the platform itself.

Base URL: `http://localhost:5002`  
API prefix: `/api/v1`  
Interactive docs: `/api/docs`  
Health: `GET /health`

Successful JSON responses use one envelope:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Login successful",
  "data": {}
}
```

Send the access token as `Authorization: Bearer <accessToken>`.

## Who uses it

| Person | How they get in | What they can do |
|---|---|---|
| Organization owner | Registers the company | Full control inside that company. Cannot touch other companies or the platform. |
| Organization admin | Invited or created by the owner | People, departments, branches, roles, settings. |
| Executive | Custom or default executive role | Directory, attendance, and request approvals. Permissions can be changed. |
| Staff | Invited or created | Own attendance, requests, projects they can see, and their files. |
| Platform admin | Seeded. Not a member of any organization. | See and suspend organizations. Does not work inside a company's data. |

`organizations:manage` is the only platform permission. It is never offered when an organization edits its roles, and it cannot be attached to an organization role.

## How an organization moves through the product

### 1. Open the company

`POST /api/v1/auth/register-organization`

Required: `organizationName`, `ownerFirstName`, `ownerLastName`, `ownerEmail`, `ownerPassword`.

Optional company details: `slug`, `legalName`, `industry`, `website`, `phone`, `address`, `city`, `state`, `country`, `timezone` (default `Africa/Lagos`), `staffRange` (`1-10`, `11-50`, `51-200`, `201-500`, `500+`), `registrationNumber`, `about`.

There is no payment step. The call creates the organization, the owner, and four system roles, then returns a session:

- `ORG_OWNER` gets every organization permission. `organizations:manage` is left out.
- `ORG_ADMIN`, `EXECUTIVE`, and `STAFF` get the smaller default sets.
- The owner is signed in immediately. `orgId` is in the token.

The slug must be lowercase letters, numbers, and hyphens, and it must be unique.

### 2. Finish the company profile

Signed in as the owner or an admin:

1. `GET /api/v1/organizations/me` reads the profile.
2. `PATCH /api/v1/organizations/me` updates the company details.
3. `POST /api/v1/organizations/me/logo` and `POST /api/v1/organizations/me/icon` upload the brand. Multipart field name is `file`. Icons are limited to 2 MB.
4. `PATCH /api/v1/organizations/me/settings` sets work start, work end, auto-checkout (`HH:MM`), work days (`0` Sunday through `6` Saturday), suggestions, and screentime.

The page title and mail body use the organization name. Mail is still sent from the platform mailbox (`SMTP_FROM`), not from the company's own address.

### 3. Add the structure

Departments and branches are not fixed. Each company creates its own.

| Action | Method and path | Permission |
|---|---|---|
| Create a department | `POST /api/v1/departments` | `departments:manage` |
| List departments | `GET /api/v1/departments` | `departments:view` |
| Edit a department | `PATCH /api/v1/departments/:id` | `departments:manage` |
| Deactivate a department | `PATCH /api/v1/departments/:id/deactivate` | `departments:manage` |
| Create a branch | `POST /api/v1/branches` | `branches:manage` |
| List branches | `GET /api/v1/branches` | `branches:view` |
| Edit a branch | `PATCH /api/v1/branches/:id` | `branches:manage` |
| Deactivate a branch | `PATCH /api/v1/branches/:id/deactivate` | `branches:manage` |

A department has `name`, optional `description`, and optional `headUserId`. A branch has `name`, `address`, `city`, `state`, and `country`. Names are unique inside the organization.

### 4. Decide who can do what

`GET /api/v1/roles` lists this organization's roles.  
`GET /api/v1/roles/permissions` lists permissions an organization is allowed to grant.  
`POST /api/v1/roles` creates a role such as `FINANCE_LEAD`. The name must be `SCREAMING_SNAKE_CASE`.  
`PATCH /api/v1/roles/:id/permissions` replaces that role's permissions. Body: `{ "permissionKeys": ["users:view"] }`.

`ORG_OWNER` cannot be edited. A new executive-style role is just another role with the permissions you attach. The default `EXECUTIVE` role is only a starting point.

### 5. Bring people in

Two ways:

**Invitation.** `POST /api/v1/invitations` with `email`, optional `roleId`, optional `departmentId`. The person receives the organization name and a token, valid for 7 days. They join with:

`POST /api/v1/auth/accept-invitation`

```json
{
  "token": "…",
  "firstName": "Ada",
  "lastName": "Okoye",
  "password": "at-least-8"
}
```

`GET /api/v1/invitations` lists them. `PATCH /api/v1/invitations/:id/cancel` cancels a pending one.

**Direct account.** `POST /api/v1/users` creates a staff account in this organization. The admin can later `POST /api/v1/users/:id/reset-password`, `PATCH /api/v1/users/:id/permissions`, `PATCH /api/v1/users/:id/deactivate`, or `PATCH /api/v1/users/:id/attendance-exemption`.

Exempt staff do not check in or check out.

### 6. Work

**Projects.** `POST /api/v1/projects`

```json
{
  "name": "Harvest rollout",
  "description": "Optional",
  "departmentId": null,
  "visibility": "DEPARTMENT",
  "status": "PLANNING",
  "startDate": "2026-10-01",
  "endDate": "2026-12-01",
  "members": [{ "userId": "…", "role": "MEMBER" }]
}
```

`visibility` is `PUBLIC` (everyone in the organization), `DEPARTMENT` (that department), or `PRIVATE` (creator plus invited members). A member from another department can be invited. Member roles are `OWNER`, `MANAGER`, `MEMBER`, and `VIEWER`. The creator is stored as owner.

Tasks live under the project: `GET` and `POST /api/v1/projects/:projectId/tasks`, then `PATCH /api/v1/tasks/:id`, `PATCH /api/v1/tasks/:id/status`, and `DELETE /api/v1/tasks/:id`. Status values are `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`, and `BLOCKED`. Priority values are `LOW`, `MEDIUM`, `HIGH`, and `URGENT`. Assign with `assigneeId`.

**Attendance.** `POST /api/v1/attendance/check-in` and `POST /api/v1/attendance/check-out`. Managers use `GET /api/v1/attendance`, `GET /api/v1/attendance/pending-review`, and `PATCH /api/v1/attendance/:id/review`. Auto-checkout follows the organization setting.

**Requests.** `GET /api/v1/requests/categories`, `POST /api/v1/requests`, `GET /api/v1/requests/me`. Reviewers use `GET /api/v1/requests` and `PATCH /api/v1/requests/:id/review`.

**Files.** `POST /api/v1/uploads` as multipart: `file`, and optionally `entityType` plus `entityId` together. Allowed entity types are `PROJECT`, `TASK`, `STAFF_REQUEST`, and `EVENT`. `GET /api/v1/uploads` returns `{ items, meta }` for people with `uploads:view_all`. `GET /api/v1/uploads/me` returns the caller's own files. `GET /api/v1/uploads/:id/download` downloads. `GET /api/v1/uploads/:id/preview` returns a short-lived inline URL for images, PDF, audio, video, and text. The bucket is private, so the stored URL is not what the browser should open directly.

**Also available to staff:** events, calendar (`GET /api/v1/calendar/monthly`), suggestions, notifications, screentime, and the activity log (`GET /api/v1/activities/me`, or `GET /api/v1/activities` with `activities:view_all`).

### 7. Everyday sign-in

`POST /api/v1/auth/login` with `email` and `password`.  
`POST /api/v1/auth/refresh` with `refreshToken`.  
`POST /api/v1/auth/logout` with the bearer token.  
`POST /api/v1/auth/change-password` with `currentPassword` and `newPassword`.

The access token carries `sub`, `orgId`, `isPlatformAdmin`, and the permission list. Access tokens default to 15 minutes. Refresh tokens default to 7 days. Role permission keys are cached in Redis for about an hour (`CACHE_RBAC_TTL_SECONDS`). Changing a role clears that role's cache. Logging out does not change what `GET /roles/permissions` returns.

## Platform admin

Create this account with the seed, not with organization registration. The user has `isPlatformAdmin: true` and `organizationId: null`.

They sign in with the same login endpoint. Tenant routes that require an organization reject this token.

With `organizations:manage` they can:

- `GET /api/v1/organizations` to see companies
- `PATCH /api/v1/organizations/:id/status` with `{ "isActive": false }` to suspend one

They do not open a company's projects, files, or staff records from these routes. Counts used for monitoring stay on the organization record.

## For developers

Stack: NestJS, Prisma 7 with the PostgreSQL driver adapter, PostgreSQL, Redis, Zod request validation, Swagger, Socket.IO for permission-change notices, and S3-compatible storage (or local disk).

### Environment

Use `.env.local`. Docker Compose only interpolates variables from the file you pass with `--env-file`. `env_file` inside the compose file loads them into the container, but it does not fill `${POSTGRES_USER}` in the compose file itself.

```env
PORT=5002
CORS_ORIGINS=http://localhost:4200

DATABASE_URL=postgresql://USER:PASSWORD@postgres:5432/staff_platform_db?schema=public
DIRECT_URL=postgresql://USER:PASSWORD@postgres:5432/staff_platform_db?schema=public
REDIS_URL=redis://redis:6379

JWT_ACCESS_SECRET=replace-me
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Workplace <noreply@mail.example.com>"

PLATFORM_ADMIN_EMAIL=admin@example.com
PLATFORM_ADMIN_PASSWORD=change-me-now
PLATFORM_ADMIN_FIRST_NAME=Platform
PLATFORM_ADMIN_LAST_NAME=Admin

STORAGE_DRIVER=s3
AWS_S3_ENDPOINT=
AWS_S3_BUCKET=
AWS_REGION=eu-central-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
UPLOAD_DIR=uploads
MAX_UPLOAD_SIZE_MB=500
MAX_FILES_PER_UPLOAD=100
```

`DATABASE_URL` inside Compose must use the hostname `postgres`, not a hosted Neon user, or the API fails with `P1000`.

### Run

From the API repo, with Docker:

```bash
docker compose --env-file .env.local build api
docker compose --env-file .env.local up -d
```

Apply the committed migration and seed permissions plus the platform admin. Do this against the database the API is using:

```bash
docker compose --env-file .env.local exec api npx prisma migrate deploy
docker compose --env-file .env.local exec api npx tsx prisma/seeds/seed.ts
```

If those commands are not how this repo's image is built, run the same two commands in the environment where `DATABASE_URL` points at that Postgres. The seed file is `prisma/seeds/seed.ts`. It upserts permission keys and the platform admin. It does not create a sample organization.

Reset a local database only when you mean to delete it:

```bash
docker compose --env-file .env.local down -v
```

### Tenancy rules

- Almost every row has `organizationId`.
- Services take the organization from the token (`requireOrgId`). Do not trust an organization id from the body.
- Platform-only tokens have `orgId: null` and are rejected by `TenantGuard` on organization routes.
- Project reads go through the visibility check: public, same department, or a member.
- Uploads check that the caller can access the project, task, or request before attaching a file.

### Adding a permission

1. Add the key and description in `prisma/seeds/seed.ts`.
2. Run the seed again. It upserts.
3. Add the key to `ORG_ADMIN`, `EXECUTIVE`, or `STAFF` in `src/organizations/default-roles.ts` only if new organizations should receive it. Existing organizations keep the permissions already stored on their roles.
4. Guard the route with `@RequirePermissions("your:key")`.
5. If the key must never be granted inside a company, add it to `PLATFORM_ONLY_PERMISSIONS` instead of a default role.

### Response and validation

- Controllers validate with Zod (`ZodValidationPipe`). The Swagger body is generated from the same schema.
- `@ResponseMessage()` sets the envelope message.
- Download and redirect endpoints send the raw response and skip the envelope.
- Dates accept `YYYY-MM-DD` or a full ISO timestamp.

### Useful paths

| Path | Purpose |
|---|---|
| `src/main.ts` | Prefix, CORS, Swagger, port |
| `src/organizations/default-roles.ts` | Roles created with a new organization |
| `src/common/tenant.ts` | Organization scoping helpers |
| `src/common/project-access.ts` | Who can see or manage a project |
| `prisma/schema/` | Split Prisma schema |
| `prisma/seeds/seed.ts` | Permissions and platform admin |
| `/api/docs` | Current request and response shapes |

Socket events notify connected clients when a role's permissions change, so an open session can refresh its access list.
