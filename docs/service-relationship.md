# Service Relationship Record

**Project:** Lead Capture RaaS MVP  
**Project ID:** `at-customer-webapp`  
**Client / organization:** Alamo Tech LLC (product owner; no named client)  
**Status:** APPROVED  
**Approved by:** Mike Turner  
**Approved at:** 2026-10-23  
**Record version:** 2  
**Prompt:** `serviceclassprompt.md`

This file is the **operational gate record** for what service Alamo Tech owes this client/project.  
It is **not** the execution cursor (`active.json`) and **not** an SLA clock.

Record version 1 (2026-10-23) classified this repository `NOT_APPLICABLE` and left RaaS operational services in `raas-control-plane`. Version 2 records the product-owner instruction for the Lead Capture RaaS MVP on this private application.

---

## Classification

| Field | Value |
|-------|--------|
| `service_relationship` | ACTIVE_PROJECT |
| Additional relationships | none |
| `engagement_channel` | N/A |
| `platform_governed` | N/A |
| Written agreement | NONE |
| Unenforceable hours (manual add / no catchup) | N/A |
| SLA profile | NONE |
| `sla_status` | NOT_APPLICABLE |
| Contract / addendum status | N/A |
| Agreement ids | none |
| Relationship since | 2026-10-23 |
| NOT_APPLICABLE reason | — |

Engagement class: `ACTIVE_PROJECT`  
Classification status: `APPROVED`  
Project: Lead Capture RaaS MVP  
Owner: Alamo Tech LLC  
Contract/retainer: N/A — internal product development  
SLA: N/A — internal product development

This is internal Alamo Tech product development. It is not an Active Retainer. There is no monthly managed-services retainer and no SLA.

### Conditions (if APPROVED WITH CONDITIONS)

- none

### Flags

- none

The canonical classification model describes `NOT_APPLICABLE` for a product with no named client, and `ACTIVE_PROJECT` for a written SOW or accepted proposal. No SOW exists. The product owner directed `ACTIVE_PROJECT` for this internal MVP, using the same fields already recorded on `at-alamotechllc-website` and `raas-control-plane`. That direction is the record. It does not create a retainer or an SLA.

### Entitlements (must match class)

| Entitlement | This record |
|-------------|-------------|
| Scheduled cadence / weekly meeting | No |
| Retainer priority | No |
| Proactive care | No |

In-scope work is the Lead Capture RaaS MVP. Verbal-only or unenforceable weekly hours **cannot** be `ACTIVE_RETAINER`.

---

## Governing constraints (additive)

| constraint_type | source | precedence | evidence_reference | verified_at |
|-----------------|--------|------------|--------------------|-------------|
| OTHER | Product-owner classification for internal Lead Capture RaaS MVP | unknown | This file; operator instruction `Classification status: APPROVED` on 2026-10-23 | 2026-10-23 |
| OTHER | Approved RaaS contracts copied into `docs/raas/` | unknown | `docs/raas/06` through `docs/raas/12` | 2026-10-23 |

Do not assume which constraint overrides another unless **precedence** is documented in the evidence cited.

Production DNS, Firebase/GCP project creation, and a repository merge are not authorized by this classification. Those remain separate approvals.

---

## Coverage for typical work

**Covered under this primary relationship:** Internal Lead Capture RaaS MVP work on the private Alamo Tech customer application (`at-alamotechllc-webapp`): the audit, the repository recommendation, the Milestone 1 plan, and later implementation of that milestone when a session is approved to build. Tenant Zero is Alamo Tech LLC.

**Excluded / not covered:** Named-client delivery. The public marketing site remains `at-alamotechllc-website`. MailGuard remains `at-domainmail-webapp`. AlamoOS internal data is not a customer data store. Security, Automation, Compliance, and Technology RaaS are out of the MVP. Production cloud resources and DNS are a separate approval.

Operational RaaS code already exists in `raas-control-plane`. This record does not move that code. Colocation is an open product-owner decision recorded in `docs/raas/REPOSITORY-ARCHITECTURE.md`.

Uncovered work is not silently treated as retainer-covered.

---

## Evidence

| Claim | Label | Citation |
|-------|-------|----------|
| No named client, contract, or retainer exists for this product | Observed | No `CLIENT.md`, SOW, or retainer in this repository |
| Product owner directed `ACTIVE_PROJECT`, status `APPROVED`, for internal Lead Capture RaaS MVP | Client-stated | Session instruction 2026-10-23 |
| The same class is already recorded for this MVP on the marketing site and the control plane | Observed | `at-alamotechllc-website/docs/service-relationship.md`; `raas-control-plane/docs/contracts/service-relationship.md` |
| Record version 1 was `NOT_APPLICABLE` | Observed | This file before version 2 |
| Owner is `human:mike@alamotechllc.net` | Observed | `alamo.manifest` `ownership.owner` |
| Prior approver of version 1 was Mike Turner | Observed | Record version 1 approval block |

---

## Approval

```text
Status: APPROVED
Approver: Mike Turner
Date: 2026-10-23
Reply used: Classification status: APPROVED
Class recorded: ACTIVE_PROJECT
```

No implicit approval. Chat-only yes does not satisfy the gate until this file is written.
