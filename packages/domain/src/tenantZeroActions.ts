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
      description: "Confirm your Lead Capture service is active and matches what you expect for your business.",
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
      description: "Open Results and confirm Appointments Booked matches what you see on your calendar.",
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
      description: "Review how your data is kept separate from other organizations on the platform.",
      assignedTo: "all",
      priority: 50,
      createdAt,
    },
    {
      id: "act_seed_poc_member",
      tenantId,
      title: "Confirm your account access",
      description: "Verify you can sign in and see the right organization in the Command Center.",
      assignedTo: TENANT_ZERO_POC_MEMBER_UID,
      priority: 15,
      createdAt,
    },
    {
      id: "act_seed_dev_deploy",
      tenantId,
      title: "Review deployment checklist",
      description: "Before any preview release, confirm your team follows the approved deployment checklist.",
      assignedTo: "all",
      priority: 60,
      createdAt,
    },
  ];
}
