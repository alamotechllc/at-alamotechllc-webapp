# GoHighLevel appointment reconciliation

**Status:** Designed, not built. Milestone 1 records `reconcileMode: webhook_only`.

The adapter already has `AppointmentReconciler`. A daily job can call it later without a new event path. Webhook bookings and pulled bookings both go through `mapGhlWebhook` and then `raas-ingress`.

## Capability required from GoHighLevel

Appointment reconciliation needs a read of calendar events for one location and one time window:

- `GET https://services.leadconnectorhq.com/calendars/events`
- Header `Version: v3`, as published for that route. Confirm the header when the live app is certified.
- Query `locationId`, `startTime`, and `endTime` as epoch milliseconds.
- Query also needs one of `calendarId`, `userId`, or `groupId`.
- OAuth scope `calendars/events.readonly`. Do not request `calendars/events.write` for reconciliation.

The webhook signing secret and the API token are different credentials. Both belong in the binding's Secret Manager payload. The token is not the HMAC key used on `X-Provider-Signature`.

The binding already stores non-secret provider configuration (`providerConfig.calendarId`). That id is not copied onto `AppointmentBooked`.

The list response includes contact fields. The reconciler must pass each row through `mapGhlWebhook` and drop everything that is not an approved attribute. It must not log the row.

Until that token and a certified response sample exist, the binding stays `webhook_only`. A reconciliation run for that mode returns `seen: null` and does not call GoHighLevel. That avoids a false green.

## Local signature

Live GoHighLevel webhook signing is not confirmed. The local adapter verifies HMAC-SHA256 of the exact request bytes in `X-Provider-Signature`. Do not publish this adapter until the vendor scheme is confirmed. The fixture secret is not a credential.
