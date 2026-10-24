# Google Analytics

The command center reports product usage to the GA4 stream on the Firebase web app `at-alamotechllc-webapp`. The measurement id is `G-RRYGB3TE12`.

`App_Projects/at-growth-engine` is not present on this machine. The event style follows `at-alamotechllc-website/src/hooks/useAnalytics.ts`: one initializer, snake_case event names, and a page view when navigation changes. This app uses Firebase Analytics (`firebase/analytics`) instead of `react-ga4`, because the measurement id already belongs to this Firebase web app.

## Where it lives

| Piece | File |
| --- | --- |
| Screen names and the production gate | `apps/web/src/analytics-catalog.ts` |
| Firebase Analytics calls | `apps/web/src/analytics.ts` |
| Route listener | `ProductAnalytics` in `apps/web/src/main.tsx` |
| Sign-in, sign-out, and access retry | `apps/web/src/auth.tsx` |
| Data retry | `apps/web/src/data.tsx` |

Components do not call Firebase Analytics directly.

## When events are sent

Collection is on only when all of these are true:

- the Vite build is not a dev server
- the Auth emulator is off
- `VITE_DEPLOY_CHANNEL` is `production`
- `VITE_FIREBASE_APP_ID` and a `G-` measurement id are present
- the hostname is not `localhost`, `127.0.0.1`, or a Hosting preview channel (`--` in the host)

Local development and the `dev` preview channel do not send events to the production stream. The automatic first page view is disabled. The route listener sends one `page_view` per screen change.

A React rerender of the same screen does not send another page view. Restoring an existing session does not count as a completed login. `login_completed` is sent only after `login_started` in that page load.

## Screens

| Route | Recorded path | Event |
| --- | --- | --- |
| `/sign-in` | `/sign-in` | `login_viewed` |
| Authorized shell, once per page load | `command_center` | `command_center_viewed` |
| `/` | `/` | `raas_overview_viewed` |
| `/clients` | `/clients` | `clients_viewed` |
| `/clients/{id}` | `/clients/detail` | `clients_viewed` |
| `/campaigns` | `/campaigns` | `campaigns_viewed` |
| `/appointments` | `/appointments` | `appointments_viewed` |
| `/results` | `/results` | `results_viewed` |
| `/operations` | `/operations` | `operations_viewed` |

There is no separate Command Center overview route. The shell is the command center, and `/` is the overview. A visit to `/raas` is recorded as the same screen after the `/raas` prefix is removed.

The client route drops the tenant id before anything is sent.

## Event catalog

| Event | When |
| --- | --- |
| `login_viewed` | The sign-in screen is shown |
| `login_started` | Google or the local emulator form is submitted. Property: `method` `google` or `password` |
| `login_completed` | That attempt becomes an authorized session |
| `logout` | Sign out |
| `command_center_viewed` | The authorized shell is shown, once per page load |
| `raas_overview_viewed` | `/` |
| `clients_viewed` | Clients list or a client screen |
| `campaigns_viewed` | Campaigns |
| `appointments_viewed` | Appointments |
| `results_viewed` | Results |
| `operations_viewed` | Operations |
| `result_score_viewed` | The result score is shown. Properties: `availability` `scored` or `insufficient`, and `status`. No customer, lead, or appointment identifiers |
| `score_component_opened` | A score part is opened. Property: `component` id |
| `chart_period_changed` | The 30, 60, or 90 day control changes. Property: `period` |
| `insight_opened` | An insight is opened. Property: `insight` id |
| `recommendation_opened` | A recommendation is opened. Property: `recommendation` id |
| `funnel_viewed` | The lead funnel is shown |
| `retry_requested` | Retry on an access check or a data load. Several retries from one click count once |
| `reporting_period_changed` | Reserved. The results window is the current month and there is no period control yet |
| `refresh_requested` | Reserved. The current screens use retry, not a separate refresh control |

Properties are `screen` and, for login, `method`. Score events add `availability`, `status`, `component`, `period`, `insight`, or `recommendation`. Those values are ids and status words. Events do not include names, email addresses, tenant ids, leads, appointments, messages, or other operational record contents.

## Configuration

Production collection needs these public values in the gitignored `.env` before a production Hosting build:

- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`

`npm run deploy:dev` sets `VITE_DEPLOY_CHANNEL=dev`, so a preview deploy does not collect. `deploy.md` sets `VITE_DEPLOY_CHANNEL=production` only for the production release.
