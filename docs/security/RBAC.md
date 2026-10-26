# RBAC

The canonical roles are `platform_admin`, `operator`, `tenant_admin`, and `tenant_viewer`.

## Mapping

| Existing name | Canonical role |
| --- | --- |
| `platform_admin` | `platform_admin` |
| `operator` | `operator` |
| PRD `platform_operator` | `operator` |
| `tenant_admin` | `tenant_admin` |
| `tenant_viewer` | `tenant_viewer` |
| PRD `tenant_user` | Not an API role. A customer who can act is a `tenant_admin` or a later explicit permission, not a fifth role |

No additional role was added.

## Records

| Role | Authority |
| --- | --- |
| `platform_admin` | `platformAdmins/{uid}` with `status: active`, plus staff eligibility |
| `operator` | `operators/{uid}` with `status: active`, plus `operators/{uid}/assignments/{tenantId}`, plus staff eligibility |
| `tenant_admin` | `tenants/{tenantId}/members/{uid}` with `role: tenant_admin` and `status: active` |
| `tenant_viewer` | `tenants/{tenantId}/members/{uid}` with `role: tenant_viewer` and `status: active` |

Staff eligibility requires the Workspace domain `alamotechllc.com` (emulator stand-in `@alamotechllc.test`). Domain membership does not create either staff record.

## Permissions in this phase

Only permissions with a route are defined. `packages/domain/src/rbac.ts` is the table.

| Permission | Route |
| --- | --- |
| `tenant.read` | `GET /v1/tenants/:tenantId`, `GET /v1/tenants/:tenantId/service-instances` |
| `appointment.read` | `GET /v1/tenants/:tenantId/appointments`, `GET /v1/tenants/:tenantId/events` |
| `result.read` | `GET /v1/tenants/:tenantId/results` |
| `providerBinding.read` | `GET /v1/tenants/:tenantId/provider-bindings` |
| `providerBinding.manage` | `POST /v1/tenants/:tenantId/provider-bindings` |
| `task.read` | Command Center `/tasks` |
| `task.write` | Create a task and mark it open or done. The browser writes `tenants/{tenantId}/tasks/{taskId}` |

`secretResource` on a binding response is still returned only to `platform_admin`.

Leads, campaigns, integrations, user management, and operator-management permissions are not defined until those routes exist. Add a permission to `PERMISSIONS` and to the role grant list. Do not scatter `role === "platform_admin"` through route handlers.

## Matrix

| Role | Scope | Permissions | Restrictions |
| --- | --- | --- | --- |
| `platform_admin` | All tenants, audited in the request log | All permissions above. Binding responses may include `secretResource` | Must be an explicit `platformAdmins` record on `@alamotechllc.com` (or the emulator test domain). Not implied by the domain. Cannot be granted to an external Google account |
| `operator` | Assigned tenants only | All permissions above. Binding responses omit `secretResource` | Must be an explicit active operator and an assignment for the requested tenant. An Alamo Tech account with no assignment is denied. An external Google account cannot be an operator |
| `tenant_admin` | One membership tenant | `tenant.read`, `appointment.read`, `result.read`, `providerBinding.read`, `task.read`, `task.write` | No other tenant. No binding create. No platform configuration. No provider secrets. Cannot become staff |
| `tenant_viewer` | One membership tenant | `tenant.read`, `appointment.read`, `result.read`, `providerBinding.read`, `task.read` | No privileged writes, including binding create and task changes |

Empty means denied. A disabled record denies the next request.
