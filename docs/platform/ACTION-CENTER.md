# Action Center (Next Steps)

The Action Center is a **platform capability** on the Alamo Tech Customer Command Center. Customers see it as **Next Steps**: the few things Alamo Tech needs from them next. It is not task management, ticketing, or workflow.

## Purpose

- Surface tenant-scoped, prioritized requests for the signed-in member
- Show progress across applicable steps
- Limit the default view to three pending steps
- Record completion per member without exposing other tenants or private assignments

Action Center sits above product modules (RaaS Lead Capture today). An action may link to a module route via an optional CTA, but the model does not live under Lead Capture.

## Domain model

Defined in `packages/domain/src/actionCenter.ts`:

| Type | Role |
| --- | --- |
| `CustomerAction` | Tenant-scoped definition: title, description, `assignedTo`, `priority`, optional CTA |
| `ActionCompletion` | Per-member completion record with `completedAt` |

Authoritative limit: `MAX_VISIBLE_ACTIONS = 3`.

Progress:

```text
round(completedApplicable / totalApplicable × 100)
```

Zero applicable actions → **You're all caught up** (not “100% complete”).

## Firestore model

| Path | Access |
| --- | --- |
| `tenants/{tenantId}/actions/{actionId}` | Read when the caller can read the tenant **and** `assignedTo` is `all` or the caller's uid. No client writes. |
| `tenants/{tenantId}/members/{uid}/actionCompletions/{actionId}` | Read/create for the caller's own uid when the action exists and applies to them. No update/delete. |

Definitions are seeded or written by trusted server processes (Tenant Zero seed on the emulator only).

## Read path (this repository)

Ordinary Command Center reads use the Firebase web SDK in the browser under Firestore rules (`docs/architecture/FIREBASE-ARCHITECTURE.md`). Action Center follows that pattern:

- `loadCustomerActions` → filtered queries on `tenants/{tenantId}/actions` (`assignedTo == "all"` and `assignedTo == uid`). An unfiltered collection read fails rules when any private assignment exists.
- `loadActionCompletions` → `tenants/{tenantId}/members/{uid}/actionCompletions`

There is **no** Action Center REST proxy in Milestone 1. Do not add a Function whose only job is to replay these reads.

## Completion write path

Completions are **member-scoped operational state**. The browser writes a single document with `setDoc` to the caller's `actionCompletions` subcollection. Rules validate:

- Active tenant access
- Action exists on the tenant
- `assignedTo` is `all` or the caller's uid
- Immutable fields (`actionId`, `tenantId`, `completedAt` only)

This matches the existing pattern for tenant `tasks` (client write under strict rules), but completions are limited to members completing their own applicable actions—not staff-defined task CRUD.

## Assignment

An action applies when:

```text
assignedTo === "all" OR assignedTo === authenticated uid
```

Role-based assignment is out of scope for the MVP.

## Security

- Tenant isolation via existing `canReadTenant`
- Private actions are hidden at rule evaluation time (not only in UI)
- Users cannot change action definitions or another member's completions
- Optional CTAs are filtered with `isAllowedActionUrl` (blocks `javascript:`, `data:`, `file:`; prefers HTTPS and allows internal paths)

## Tenant Zero seed

`npm run seed:tenant-zero` (emulator only) merges. For a tenant-admin sign-in on the emulator, also run `npm run seed:tenant-poc-member` (creates `tenant.admin@client.example` / `local-dev-only` for uid `tz_poc_member_admin`).

`npm run seed:tenant-zero` merges:

- Seven POC actions from `tenantZeroCustomerActions()` in `packages/domain/src/tenantZeroActions.ts`
- Emulator POC member `tz_poc_member_admin` for one user-assigned step

Mike's production Google uid is **not** invented. Configure live user assignment when membership is known.

## Future boundaries (not implemented)

Admin UI, notifications, dependencies, due-date automation, Kanban, weighted progress, and cross-repository shared packages are explicitly out of scope.
