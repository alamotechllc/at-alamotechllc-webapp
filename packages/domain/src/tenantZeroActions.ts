import { TENANT_ZERO } from "./tenantZero.js";
import type { CustomerAction } from "./actionCenter.js";

/** Emulator POC member for a user-assigned Next Step. Not Mike's production uid. */
export const TENANT_ZERO_POC_MEMBER_UID = "tz_poc_member_admin";

/** Repeatable Tenant Zero Action Center seed (emulator only). */
export function tenantZeroCustomerActions(): CustomerAction[] {
  const tenantId = TENANT_ZERO.tenantId;
  const createdAt = "2026-10-01T12:00:00.000Z";
  return [
    {
      id: "act_seed_profile",
      tenantId,
      title: "Complete business profile",
      description: "Confirm legal name, timezone, and primary contact so the Command Center reflects Alamo Tech LLC accurately.",
      assignedTo: "all",
      priority: 10,
      createdAt,
    },
    {
      id: "act_seed_lead_capture",
      tenantId,
      title: "Review Lead Capture configuration",
      description: "Walk through the active Lead Capture service instance and confirm it matches the Milestone 1 POC scope.",
      assignedTo: "all",
      priority: 20,
      actionLabel: "Open Lead Capture",
      actionUrl: "/",
      createdAt,
    },
    {
      id: "act_seed_appointments",
      tenantId,
      title: "Verify appointments booked metric",
      description: "Open Results and confirm Appointments Booked reflects emulator seed data for Tenant Zero.",
      assignedTo: "all",
      priority: 30,
      actionLabel: "View Results",
      actionUrl: "/results",
      createdAt,
    },
    {
      id: "act_seed_campaigns",
      tenantId,
      title: "Review campaign attribution",
      description: "Check Campaigns for booking counts and unattributed appointments in the current window.",
      assignedTo: "all",
      priority: 40,
      actionLabel: "View Campaigns",
      actionUrl: "/campaigns",
      createdAt,
    },
    {
      id: "act_seed_security",
      tenantId,
      title: "Read MVP security model",
      description: "POC: skim docs/raas/11-mvp-security-model.md so everyone shares the same tenant-isolation expectations.",
      assignedTo: "all",
      priority: 50,
      createdAt,
    },
    {
      id: "act_seed_poc_member",
      tenantId,
      title: "POC: confirm tenant admin membership",
      description: "Emulator-only step assigned to the seeded POC member uid (tz_poc_member_admin), not a production user.",
      assignedTo: TENANT_ZERO_POC_MEMBER_UID,
      priority: 15,
      createdAt,
    },
    {
      id: "act_seed_dev_deploy",
      tenantId,
      title: "POC: DEV hosting checklist",
      description: "Before any DEV deploy, confirm deploy.md gates and that production phrases are not used accidentally.",
      assignedTo: "all",
      priority: 60,
      createdAt,
    },
  ];
}
