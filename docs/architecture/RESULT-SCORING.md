# Result scoring

The command center reads tenant profile, service instances, campaigns, leads, and appointments from Firestore. It does not read events, provider bindings, or audit records. Those stay server-only. There is no chart library in the web app. Charts are drawn as SVG from the counts already on the screen.

Official Lead Capture metrics in `packages/domain/src/results.ts` are computed from business events. The browser cannot read those events, so it cannot reproduce response time, call counts, automation results, or opportunity value.

Client writes are denied. Historical scores are not stored in Firestore. A 30, 60, or 90 day chart is counted from `leads.createdAt` and `appointments.startAt` when the dashboard loads. A result-score line is omitted until every score part can be measured and a previous score exists.

## Score

`packages/domain/src/scoring.ts` is not specific to Lead Capture. A product supplies parts whose weights total 100. A part is scored only when it has a raw value, a target, and no missing-data reason.

Higher is better: `round(raw / target * 100)`, clamped to 0–100. Lower is better: 100 when raw is at or below the target, otherwise `round(target / raw * 100)`.

The overall score is the weighted sum, rounded. If any part is missing, or the weights do not total 100, the overall score is hidden.

Status uses the rounded score: 90–100 Excellent, 75–89 Good, 60–74 Watch, 40–59 At Risk, 0–39 Critical.

## Lead Capture parts

| Part | Weight | What is scored |
| --- | --- | --- |
| Capture Health | 30 | Not scored. No capture target is defined. Counts are shown instead. |
| Response Performance | 25 | Not scored. Response time needs events that are not on this screen. |
| Conversion Performance | 20 | Not scored. No conversion target is defined. Appointments without a lead id are not treated as conversions. |
| Automation Health | 15 | Not scored. Automation results are not on this screen. |
| Data Quality | 10 | Scored when the period has leads. Score is the percent of those leads with an email or phone. Target is 100. |

The result score stays hidden until all five parts are measured.
