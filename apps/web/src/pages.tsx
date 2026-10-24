import { Link, useParams } from "react-router-dom";
import type { ReactNode } from "react";
import { TENANT_ZERO } from "../../../packages/domain/src/tenantZero.js";
import { StatusBadge, statusTone } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { AppCard, MetricCard, StatusCard } from "./components/ui/card";
import { DataTable, EmptyState, ErrorState, LoadingState, SectionHeader, UnavailableValue } from "./components/ui/states";
import { useSession } from "./auth";
import { useApi, type LoadState } from "./data";
import { formatWhen } from "./format";
import { campaignHealth, type CampaignVerdictLabel } from "./campaign-health";
import { metricWindow, presentMetrics } from "./metrics";
import { retryAll, sharedFailure, unavailableLabel } from "./view-state";

interface Tenant { tenantId: string; legalName: string; status: string; timezone: string }
interface Instance { instanceId: string; productCode: string; status: string; metricPolicyVersion: string }
interface Binding { bindingId: string; provider: string; externalAccountId: string; channel: string; status: string; reconcileMode?: string }
interface Appointment {
  appointmentId: string;
  status: string;
  provider: string;
  providerAppointmentId: string;
  startAt: string;
  endAt: string;
  timezone: string;
  campaignId: string | null;
}
interface Campaign {
  campaignId: string;
  name: string;
  channel: string;
  status: string;
}
interface BusinessEvent { eventId: string; eventType: string; occurredAt: string; recordedAt: string }
interface Results { metrics: Record<string, { value: number | null; unit: string }> }

const window = metricWindow();

function useWorkspaceTenantId(): string {
  const session = useSession();
  if (session.role === "tenant_admin" || session.role === "tenant_viewer") return session.tenantId ?? "";
  return TENANT_ZERO.tenantId;
}

function resultsQuery(tenantId: string, instanceId: string): string {
  return `/v1/tenants/${tenantId}/results?serviceInstanceId=${instanceId}&from=${encodeURIComponent(window.from)}&to=${encodeURIComponent(window.to)}`;
}

function leadInstanceId(tenantId: string, items: Instance[] | undefined): string | undefined {
  if (tenantId === TENANT_ZERO.tenantId) return TENANT_ZERO.instanceId;
  return items?.find((item) => item.productCode === "lead-capture")?.instanceId;
}

function Region<T>({
  state,
  loading,
  empty,
  suppressed,
  children,
}: {
  state: LoadState<T>;
  loading: string;
  empty?: { when: (data: T) => boolean; title: string; detail: string };
  suppressed: boolean;
  children: (data: T) => ReactNode;
}) {
  if (state.status === "loading") return <LoadingState label={loading} compact />;
  if (state.status === "failed") {
    if (suppressed) return <UnavailableValue failure={state.failure} />;
    return <ErrorState failure={state.failure} message={state.message} onRetry={state.retry} />;
  }
  if (empty?.when(state.data)) return <EmptyState title={empty.title} detail={empty.detail} />;
  return children(state.data);
}

function bookedValue(data: Results): { quiet: boolean; value: string | number; context?: string } {
  const metric = presentMetrics(data.metrics).find((item) => item.key === "appointmentsBooked");
  if (!metric || metric.state !== "value") return { quiet: true, value: "Not configured" };
  return { quiet: false, value: metric.value, context: window.label };
}

export function OverviewPage() {
  const tenantId = useWorkspaceTenantId();
  const base = tenantId ? `/v1/tenants/${tenantId}` : null;
  const tenant = useApi<Tenant>(base);
  const instances = useApi<{ items: Instance[] }>(base ? `${base}/service-instances` : null);
  const instanceId = leadInstanceId(tenantId, instances.status === "ready" ? instances.data.items : undefined);
  const results = useApi<Results>(tenantId && instanceId ? resultsQuery(tenantId, instanceId) : undefined);
  const states = [tenant, instances, results];
  const outage = sharedFailure(states);
  const leadCapture = instances.status === "ready"
    ? instances.data.items.find((item) => item.productCode === "lead-capture")
    : undefined;
  const period = tenant.status === "ready" ? `${window.label} · ${tenant.data.legalName}` : window.label;
  const metric = results.status === "ready"
    ? bookedValue(results.data)
    : results.status === "failed"
      ? { quiet: true, value: unavailableLabel(results.failure), context: window.label }
      : null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeader eyebrow="RaaS" title="Lead Capture" detail={period} />
        {instances.status === "ready" ? (
          <StatusBadge tone={leadCapture ? statusTone(leadCapture.status) : "muted"}>
            {leadCapture ? (leadCapture.status === "active" ? "Service active" : leadCapture.status) : "Not configured"}
          </StatusBadge>
        ) : null}
      </div>
      {outage ? <ErrorState failure={outage.failure} message={outage.message} onRetry={() => retryAll(states)} /> : null}
      {metric ? (
        <MetricCard
          label="Appointments Booked"
          dominant
          quiet={metric.quiet}
          value={metric.value}
          context={metric.context}
          onRetry={results.status === "failed" && !outage ? results.retry : undefined}
        />
      ) : (
        <MetricCard label="Appointments Booked" dominant loading context={window.label} />
      )}
      <section aria-labelledby="operational-status" className="space-y-3">
        <h2 id="operational-status" className="text-sm font-semibold text-foreground-muted">Operational status</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatusCard label="Service status">
            <Region state={instances} loading="Loading the service" suppressed={Boolean(outage)}>
              {() => leadCapture
                ? <StatusBadge tone={statusTone(leadCapture.status)}>{leadCapture.status}</StatusBadge>
                : <p>Not configured</p>}
            </Region>
          </StatusCard>
          <StatusCard label="Provider status">
            <p>Not shown here</p>
          </StatusCard>
          <StatusCard label="Last event">
            <p>Not shown here</p>
          </StatusCard>
          <StatusCard label="Last successful ingest">
            <p>Not shown here</p>
          </StatusCard>
        </div>
      </section>
      <section aria-labelledby="recent-activity" className="space-y-3">
        <h2 id="recent-activity" className="text-sm font-semibold text-foreground-muted">Recent activity</h2>
        <AppCard className="p-4">
          <p className="text-sm">Provider receipts stay on the server.</p>
        </AppCard>
      </section>
    </div>
  );
}

export function ClientsPage() {
  const tenantId = useWorkspaceTenantId();
  const base = tenantId ? `/v1/tenants/${tenantId}` : null;
  const tenant = useApi<Tenant>(base);
  const instances = useApi<{ items: Instance[] }>(base ? `${base}/service-instances` : null);
  const instanceId = leadInstanceId(tenantId, instances.status === "ready" ? instances.data.items : undefined);
  const results = useApi<Results>(tenantId && instanceId ? resultsQuery(tenantId, instanceId) : undefined);
  const states = [tenant, results];
  const outage = sharedFailure(states);
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <SectionHeader title="Clients" detail="Organizations with a Lead Capture service." />
      {outage ? <ErrorState failure={outage.failure} message={outage.message} onRetry={() => retryAll(states)} /> : null}
      <Region state={tenant} loading="Loading clients" suppressed={Boolean(outage)}>
        {(data) => (
          <>
          <Link
            className="block rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            to={`/clients/${data.tenantId}`}
          >
            <h2 className="text-xl font-semibold">{data.legalName}</h2>
            <p className="mt-1 text-sm text-foreground-muted">Lead Capture</p>
            <p className="mt-4 text-sm">
              {results.status === "loading" ? "Loading results" : null}
              {results.status === "failed" ? unavailableLabel(results.failure) : null}
              {results.status === "ready" ? (() => {
                const booked = bookedValue(results.data);
                return booked.quiet ? booked.value : `${booked.value} appointments booked`;
              })() : null}
            </p>
          </Link>
          {results.status === "failed" && !outage ? (
            <Button variant="outline" size="sm" className="mt-3" onClick={results.retry}>Retry</Button>
          ) : null}
          </>
        )}
      </Region>
    </div>
  );
}

export function ClientPage() {
  const params = useParams();
  const tenantId = /^ten_[A-Za-z0-9]+$/.test(params.tenantId ?? "") ? params.tenantId ?? "" : "";
  const base = tenantId ? `/v1/tenants/${tenantId}` : null;
  const tenant = useApi<Tenant>(base);
  const instances = useApi<{ items: Instance[] }>(base ? `${base}/service-instances` : null);
  const bindings = useApi<{ items: Binding[] }>(base ? `${base}/provider-bindings` : null);
  const appointments = useApi<{ items: Appointment[] }>(base ? `${base}/appointments` : null);
  const instanceId = leadInstanceId(tenantId, instances.status === "ready" ? instances.data.items : undefined);
  const results = useApi<Results>(tenantId && instanceId ? resultsQuery(tenantId, instanceId) : undefined);
  const states = [tenant, instances, bindings, appointments, results];
  const outage = sharedFailure(states);

  if (tenant.status === "loading") return <LoadingState label="Loading the client" />;
  if (tenant.status === "failed" && !outage) {
    return <ErrorState failure={tenant.failure} message={tenant.message} onRetry={tenant.retry} />;
  }

  const legalName = tenant.status === "ready" ? tenant.data.legalName : "Client";
  const timezone = tenant.status === "ready" ? tenant.data.timezone : undefined;
  const metric = results.status === "ready"
    ? bookedValue(results.data)
    : results.status === "failed"
      ? { quiet: true, value: unavailableLabel(results.failure) }
      : null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <SectionHeader title={legalName} detail={timezone} />
      {outage ? <ErrorState failure={outage.failure} message={outage.message} onRetry={() => retryAll(states)} /> : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <AppCard className="p-6">
          <h2 className="text-sm font-medium text-foreground-muted">Service</h2>
          <div className="mt-3">
            <Region state={instances} loading="Loading the service" suppressed={Boolean(outage)}>
              {(list) => {
                const service = list.items.find((item) => item.productCode === "lead-capture");
                if (!service) return <p>Not configured</p>;
                return (
                  <div className="space-y-2">
                    <p className="font-semibold">Lead Capture</p>
                    <p className="break-all text-sm text-foreground-muted">{service.instanceId}</p>
                    <StatusBadge tone={statusTone(service.status)}>{service.status}</StatusBadge>
                  </div>
                );
              }}
            </Region>
          </div>
        </AppCard>
        {metric ? (
          <MetricCard
            label="Appointments Booked"
            dominant
            quiet={metric.quiet}
            value={metric.value}
            context={window.label}
            onRetry={results.status === "failed" && !outage ? results.retry : undefined}
          />
        ) : (
          <MetricCard label="Appointments Booked" dominant loading context={window.label} />
        )}
      </div>
      <AppCard className="p-6">
        <h2 className="text-base font-semibold">Provider bindings</h2>
        <div className="mt-4">
          <Region state={bindings} loading="Loading bindings" suppressed={Boolean(outage)} empty={{ when: (list) => list.items.length === 0, title: "Not shown here", detail: "Provider accounts stay on the server." }}>
            {(list) => (
              <DataTable headers={["Provider", "Account", "Channel", "Status"]}>
                {list.items.map((item) => (
                  <tr key={item.bindingId}>
                    <td>{item.provider}</td>
                    <td>{item.externalAccountId}</td>
                    <td>{item.channel}</td>
                    <td><StatusBadge tone={statusTone(item.status)}>{item.status}</StatusBadge></td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Region>
        </div>
      </AppCard>
      <AppCard className="p-6">
        <h2 className="text-base font-semibold">Recent activity</h2>
        <div className="mt-4">
          <Region state={appointments} loading="Loading appointments" suppressed={Boolean(outage)} empty={{ when: (list) => list.items.length === 0, title: "No appointments", detail: "Booked appointments will appear here." }}>
            {(list) => <AppointmentTable items={list.items.slice(0, 5)} />}
          </Region>
        </div>
      </AppCard>
    </div>
  );
}

function verdictTone(verdict: CampaignVerdictLabel): "success" | "warning" | "muted" {
  if (verdict === "Working") return "success";
  if (verdict === "No bookings this period") return "warning";
  return "muted";
}

export function CampaignsPage() {
  const tenantId = useWorkspaceTenantId();
  const base = tenantId ? `/v1/tenants/${tenantId}` : null;
  const campaigns = useApi<{ items: Campaign[] }>(base ? `${base}/campaigns` : null);
  const appointments = useApi<{ items: Appointment[] }>(base ? `${base}/appointments` : null);
  const states = [campaigns, appointments];
  const outage = sharedFailure(states);
  const health = campaigns.status === "ready" && appointments.status === "ready"
    ? campaignHealth(campaigns.data.items, appointments.data.items, window)
    : null;
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <SectionHeader title="Campaigns" detail={`Bookings tied to each campaign · ${window.label}`} />
      {outage ? <ErrorState failure={outage.failure} message={outage.message} onRetry={() => retryAll(states)} /> : null}
      {!outage && campaigns.status === "failed" ? <ErrorState failure={campaigns.failure} message={campaigns.message} onRetry={campaigns.retry} /> : null}
      {!outage && appointments.status === "failed" ? <ErrorState failure={appointments.failure} message={appointments.message} onRetry={appointments.retry} /> : null}
      {!health && campaigns.status !== "failed" && appointments.status !== "failed" ? <LoadingState label="Loading campaigns" /> : null}
      {health && health.campaigns.length === 0 ? (
        <AppCard className="p-6">
          <EmptyState title="No campaigns yet." detail="A campaign appears here after it is recorded for this client." />
        </AppCard>
      ) : null}
      {health && health.campaigns.length > 0 ? (
        <AppCard className="p-6">
          <DataTable headers={["Campaign", "Channel", "Status", "Bookings", "Latest booking", "Verdict"]}>
            {health.campaigns.map((item) => (
              <tr key={item.campaignId}>
                <td>{item.name || item.campaignId}</td>
                <td>{item.channel}</td>
                <td><StatusBadge tone={statusTone(item.status)}>{item.status}</StatusBadge></td>
                <td>{item.bookings}</td>
                <td>{item.latestBookingAt ? formatWhen(item.latestBookingAt) : "None"}</td>
                <td><StatusBadge tone={verdictTone(item.verdict)}>{item.verdict}</StatusBadge></td>
              </tr>
            ))}
            <tr>
              <td>Not tied to a campaign</td>
              <td />
              <td />
              <td>{health.unattributedBookings}</td>
              <td>{health.unattributedLatestBookingAt ? formatWhen(health.unattributedLatestBookingAt) : "None"}</td>
              <td />
            </tr>
          </DataTable>
        </AppCard>
      ) : null}
      {health && health.campaigns.length === 0 && health.unattributedBookings > 0 ? (
        <AppCard className="p-6">
          <h2 className="text-base font-semibold">Not tied to a campaign</h2>
          <p className="mt-2 text-sm text-foreground-muted">
            {health.unattributedBookings} bookings in {window.label} have no campaign.
          </p>
        </AppCard>
      ) : null}
    </div>
  );
}

export function AppointmentsPage() {
  const tenantId = useWorkspaceTenantId();
  const base = tenantId ? `/v1/tenants/${tenantId}` : null;
  const tenant = useApi<Tenant>(base);
  const appointments = useApi<{ items: Appointment[] }>(base ? `${base}/appointments` : null);
  const states = [tenant, appointments];
  const outage = sharedFailure(states);
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <SectionHeader
        title="Appointments"
        detail={tenant.status === "ready" ? `Booked appointments for ${tenant.data.legalName}.` : "Booked appointments."}
      />
      {outage ? <ErrorState failure={outage.failure} message={outage.message} onRetry={() => retryAll(states)} /> : null}
      {tenant.status === "failed" && !outage ? <ErrorState failure={tenant.failure} message={tenant.message} onRetry={tenant.retry} /> : null}
      <AppCard className="p-6">
        <Region state={appointments} loading="Loading appointments" suppressed={Boolean(outage)} empty={{ when: (list) => list.items.length === 0, title: "No appointments", detail: "A booked appointment has not been recorded." }}>
          {(list) => <AppointmentTable items={[...list.items].sort((a, b) => b.startAt.localeCompare(a.startAt))} />}
        </Region>
      </AppCard>
    </div>
  );
}

export function ResultsPage() {
  const tenantId = useWorkspaceTenantId();
  const base = tenantId ? `/v1/tenants/${tenantId}` : null;
  const instances = useApi<{ items: Instance[] }>(base ? `${base}/service-instances` : null);
  const instanceId = leadInstanceId(tenantId, instances.status === "ready" ? instances.data.items : undefined);
  const results = useApi<Results>(tenantId && instanceId ? resultsQuery(tenantId, instanceId) : undefined);
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <SectionHeader title="Results" detail={`Lead Capture · ${window.label}`} />
      <Region state={results} loading="Loading results" suppressed={false}>
        {(data) => {
          const slots = presentMetrics(data.metrics);
          const measured = slots.filter((item) => item.state === "value");
          const waiting = slots.filter((item) => item.state === "not_configured");
          return (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {measured.map((item) => (
                  <MetricCard key={item.key} label={item.label} dominant value={item.value} context={window.label} />
                ))}
              </div>
              <AppCard className="p-6">
                <h2 className="text-base font-semibold">Not configured</h2>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {waiting.map((item) => (
                    <li key={item.key} className="flex items-center justify-between gap-3 text-sm">
                      <span>{item.label}</span>
                      <StatusBadge tone="muted">Not configured</StatusBadge>
                    </li>
                  ))}
                </ul>
              </AppCard>
            </>
          );
        }}
      </Region>
    </div>
  );
}

export function OperationsPage() {
  const tenantId = useWorkspaceTenantId();
  const base = tenantId ? `/v1/tenants/${tenantId}` : null;
  const events = useApi<{ items: BusinessEvent[] }>(base ? `${base}/events` : null);
  const bindings = useApi<{ items: Binding[] }>(base ? `${base}/provider-bindings` : null);
  const states = [events, bindings];
  const outage = sharedFailure(states);
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <SectionHeader title="Operations" detail="Provider and ingest state. This is separate from client results." />
      {outage ? <ErrorState failure={outage.failure} message={outage.message} onRetry={() => retryAll(states)} /> : null}
      <AppCard className="p-6">
        <h2 className="text-base font-semibold">Provider bindings</h2>
        <div className="mt-4">
          <Region state={bindings} loading="Loading bindings" suppressed={Boolean(outage)} empty={{ when: (list) => list.items.length === 0, title: "Not shown here", detail: "Provider accounts stay on the server." }}>
            {(list) => (
              <DataTable headers={["Provider", "Account", "Status", "Reconciliation"]}>
                {list.items.map((item) => (
                  <tr key={item.bindingId}>
                    <td>{item.provider}</td>
                    <td>{item.externalAccountId}</td>
                    <td><StatusBadge tone={statusTone(item.status)}>{item.status}</StatusBadge></td>
                    <td>{item.reconcileMode === "webhook_only" ? "Webhook only" : item.reconcileMode ?? "Not configured"}</td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Region>
        </div>
      </AppCard>
      <AppCard className="p-6">
        <h2 className="text-base font-semibold">Recent events</h2>
        <div className="mt-4">
          <Region state={events} loading="Loading events" suppressed={Boolean(outage)} empty={{ when: (list) => list.items.length === 0, title: "Not shown here", detail: "Provider receipts stay on the server." }}>
            {(list) => (
              <DataTable headers={["Event", "Occurred", "Ingested"]}>
                {list.items.map((item) => (
                  <tr key={item.eventId}>
                    <td>{item.eventType}</td>
                    <td>{formatWhen(item.occurredAt)}</td>
                    <td>{formatWhen(item.recordedAt)}</td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Region>
        </div>
      </AppCard>
      <div className="grid gap-4 md:grid-cols-2">
        <AppCard className="p-6">
          <h2 className="text-base font-semibold">Dead letters</h2>
          <div className="mt-3"><StatusBadge tone="muted">Not configured</StatusBadge></div>
        </AppCard>
        <AppCard className="p-6">
          <h2 className="text-base font-semibold">Ingest failures</h2>
          <div className="mt-3"><StatusBadge tone="muted">Not configured</StatusBadge></div>
        </AppCard>
      </div>
    </div>
  );
}

function AppointmentTable({ items }: { items: Appointment[] }) {
  return (
    <DataTable headers={["When", "Status", "Provider"]}>
      {items.map((item) => (
        <tr key={item.appointmentId}>
          <td>{formatWhen(item.startAt)}</td>
          <td><StatusBadge tone={statusTone(item.status)}>{item.status}</StatusBadge></td>
          <td>{item.provider}</td>
        </tr>
      ))}
    </DataTable>
  );
}
