import { Link, useParams } from "react-router-dom";
import { useMemo, useState, type ReactNode } from "react";
import { isStaffRole } from "../../../packages/domain/src/rbac";
import { TENANT_ZERO } from "../../../packages/domain/src/tenantZero.js";
import { StatusBadge, statusTone } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { AppCard, MetricCard } from "./components/ui/card";
import { DataTable, EmptyState, ErrorState, LoadingState, SectionHeader, UnavailableValue } from "./components/ui/states";
import { useSession } from "./auth";
import { useApi, type LoadState } from "./data";
import { formatWhen } from "./format";
import { AppointmentList } from "./components/appointments/appointment-list";
import { NextStepsCard } from "./components/action-center/next-steps-card";
import { HomeHeader } from "./components/dashboard/home-header";
import { PageShell } from "./components/layout/page-shell";
import { CommandCenterScore, type ScorePeriod } from "./components/command-center";
import { OpenTasks } from "./tasks-page";
import { campaignHealth, type CampaignVerdictLabel } from "./campaign-health";
import { leadCapturePicture } from "./lead-capture-score";
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
  leadId: string | null;
  serviceInstanceId: string;
}
interface LeadRow {
  leadId: string;
  createdAt: string;
  status: string;
  hasContact: boolean;
  serviceInstanceId: string;
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
  const session = useSession();
  const showProvider = isStaffRole(session.role ?? undefined);
  const tenantId = useWorkspaceTenantId();
  const base = tenantId ? `/v1/tenants/${tenantId}` : null;
  const [days, setDays] = useState<ScorePeriod>(30);
  const tenant = useApi<Tenant>(base);
  const instances = useApi<{ items: Instance[] }>(base ? `${base}/service-instances` : null);
  const leads = useApi<{ items: LeadRow[] }>(base ? `${base}/leads` : null);
  const appointments = useApi<{ items: Appointment[] }>(base ? `${base}/appointments` : null);
  const instanceId = leadInstanceId(tenantId, instances.status === "ready" ? instances.data.items : undefined);
  const states = [tenant, instances, leads, appointments];
  const outage = sharedFailure(states);
  const leadCapture = instances.status === "ready"
    ? instances.data.items.find((item) => item.productCode === "lead-capture")
    : undefined;
  const period = tenant.status === "ready" ? tenant.data.legalName : undefined;
  const picture = useMemo(() => {
    if (!tenantId || !instanceId || leads.status !== "ready" || appointments.status !== "ready") return null;
    return leadCapturePicture({
      customerId: tenantId,
      instanceId,
      now: new Date(),
      days,
      leads: leads.data.items,
      appointments: appointments.data.items,
    });
  }, [tenantId, instanceId, leads, appointments, days]);
  const recent = appointments.status === "ready"
    ? [...appointments.data.items].sort((a, b) => b.startAt.localeCompare(a.startAt)).slice(0, 5)
    : [];

  const serviceStatus = leadCapture?.status;
  const metricsLoading = leads.status === "loading" || appointments.status === "loading";

  return (
    <PageShell className="flex flex-col gap-8">
      <HomeHeader organization={period} serviceStatus={serviceStatus} periodDays={days} />
      {outage ? <ErrorState failure={outage.failure} message={outage.message} onRetry={() => retryAll(states)} /> : null}
      {!outage && leads.status === "failed" ? <ErrorState failure={leads.failure} message={leads.message} onRetry={leads.retry} /> : null}
      {!outage && appointments.status === "failed" ? <ErrorState failure={appointments.failure} message={appointments.message} onRetry={appointments.retry} /> : null}

      <div className="flex flex-col gap-8 xl:grid xl:grid-cols-[minmax(18rem,20rem)_minmax(0,1fr)] xl:items-start">
        <aside className="order-1 flex flex-col gap-6 xl:sticky xl:top-20 xl:order-none">
          {tenantId ? (
            <section aria-labelledby="action-heading" className="space-y-3">
              <h2 id="action-heading" className="sr-only">Action</h2>
              <NextStepsCard />
            </section>
          ) : null}
          {tenantId ? <OpenTasks tenantId={tenantId} /> : null}
        </aside>
        <div className="order-2 flex min-w-0 flex-col gap-8 xl:order-none">
          {picture ? <CommandCenterScore picture={picture} days={days} onDays={setDays} detail="home" /> : null}
          {!picture && !metricsLoading && leads.status !== "failed" && appointments.status !== "failed" ? (
            <LoadingState label="Loading your results" />
          ) : null}
          {!picture && metricsLoading ? <LoadingState label="Loading your results" /> : null}
          <section aria-labelledby="recent-activity" className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 id="recent-activity" className="text-xs font-medium text-foreground-muted">
                Recent appointments
              </h2>
              <Link className="text-sm font-medium text-accent underline-offset-4 hover:underline" to="/appointments">
                View all
              </Link>
            </div>
            <AppCard tier="secondary" className="overflow-hidden p-0">
              <div className="border-b border-border bg-muted/30 px-5 py-3">
                <p className="text-sm text-foreground-muted">Latest booked meetings from Lead Capture.</p>
              </div>
              <div className="p-5">
                {appointments.status === "loading" ? <LoadingState label="Loading appointments" compact /> : null}
                {appointments.status === "ready" ? (
                  <AppointmentList items={recent} showProvider={showProvider} />
                ) : null}
              </div>
            </AppCard>
          </section>
        </div>
      </div>
    </PageShell>
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
    <PageShell className="flex flex-col gap-6">
      <SectionHeader title="Clients" detail="Organizations with Lead Capture enabled." />
      {outage ? <ErrorState failure={outage.failure} message={outage.message} onRetry={() => retryAll(states)} /> : null}
      <Region state={tenant} loading="Loading clients" suppressed={Boolean(outage)}>
        {(data) => (
          <>
          <Link
            className="block rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm transition-shadow hover:shadow-md active:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
    </PageShell>
  );
}

export function ClientPage() {
  const session = useSession();
  const showProvider = isStaffRole(session.role ?? undefined);
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
    <PageShell className="flex flex-col gap-6">
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
                    {showProvider ? (
                      <p className="break-all text-sm text-foreground-muted">{service.instanceId}</p>
                    ) : null}
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
            {(list) => <AppointmentList items={list.items.slice(0, 5)} showProvider={showProvider} />}
          </Region>
        </div>
      </AppCard>
    </PageShell>
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
    <PageShell className="flex flex-col gap-6">
      <SectionHeader title="Campaigns" detail={`Which campaigns are producing bookings, ${window.label}.`} />
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
        <>
          <ul className="space-y-3 md:hidden">
            {health.campaigns.map((item) => (
              <li key={item.campaignId} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <p className="font-semibold text-foreground">{item.name || item.campaignId}</p>
                <p className="mt-1 text-sm text-foreground-muted">{item.channel}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge tone={statusTone(item.status)}>{item.status}</StatusBadge>
                  <StatusBadge tone={verdictTone(item.verdict)}>{item.verdict}</StatusBadge>
                </div>
                <p className="mt-3 text-sm text-foreground-muted">
                  {item.bookings} bookings, {item.latestBookingAt ? formatWhen(item.latestBookingAt) : "no bookings yet"}
                </p>
              </li>
            ))}
          </ul>
          <AppCard className="hidden p-6 md:block">
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
        </>
      ) : null}
      {health && health.campaigns.length === 0 && health.unattributedBookings > 0 ? (
        <AppCard className="p-6">
          <h2 className="text-base font-semibold">Not tied to a campaign</h2>
          <p className="mt-2 text-sm text-foreground-muted">
            {health.unattributedBookings} bookings in {window.label} have no campaign.
          </p>
        </AppCard>
      ) : null}
    </PageShell>
  );
}

export function AppointmentsPage() {
  const session = useSession();
  const showProvider = isStaffRole(session.role ?? undefined);
  const tenantId = useWorkspaceTenantId();
  const base = tenantId ? `/v1/tenants/${tenantId}` : null;
  const tenant = useApi<Tenant>(base);
  const appointments = useApi<{ items: Appointment[] }>(base ? `${base}/appointments` : null);
  const states = [tenant, appointments];
  const outage = sharedFailure(states);
  return (
    <PageShell className="flex flex-col gap-6">
      <SectionHeader
        title="Appointments"
        detail={tenant.status === "ready" ? `Booked meetings for ${tenant.data.legalName}.` : "Booked meetings from Lead Capture."}
      />
      {outage ? <ErrorState failure={outage.failure} message={outage.message} onRetry={() => retryAll(states)} /> : null}
      {tenant.status === "failed" && !outage ? <ErrorState failure={tenant.failure} message={tenant.message} onRetry={tenant.retry} /> : null}
      <AppCard className="p-5 md:p-6">
        <Region state={appointments} loading="Loading appointments" suppressed={Boolean(outage)} empty={{ when: (list) => list.items.length === 0, title: "No appointments booked yet", detail: "Booked meetings will appear here once Lead Capture records them." }}>
          {(list) => (
            <AppointmentList
              items={[...list.items].sort((a, b) => b.startAt.localeCompare(a.startAt))}
              showProvider={showProvider}
            />
          )}
        </Region>
      </AppCard>
    </PageShell>
  );
}

export function ResultsPage() {
  const tenantId = useWorkspaceTenantId();
  const base = tenantId ? `/v1/tenants/${tenantId}` : null;
  const instances = useApi<{ items: Instance[] }>(base ? `${base}/service-instances` : null);
  const instanceId = leadInstanceId(tenantId, instances.status === "ready" ? instances.data.items : undefined);
  const results = useApi<Results>(tenantId && instanceId ? resultsQuery(tenantId, instanceId) : undefined);
  return (
    <PageShell className="flex flex-col gap-6">
      <SectionHeader title="Results" detail={`What Lead Capture produced for your business, ${window.label}.`} />
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
              {waiting.length > 0 ? (
                <details className="rounded-xl border border-border bg-muted/20 p-5">
                  <summary className="cursor-pointer text-sm font-medium text-foreground">Additional metrics (coming soon)</summary>
                  <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                    {waiting.map((item) => (
                      <li key={item.key} className="flex items-center justify-between gap-3 text-sm text-foreground-muted">
                        <span>{item.label}</span>
                        <StatusBadge tone="muted">Soon</StatusBadge>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </>
          );
        }}
      </Region>
    </PageShell>
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
    <PageShell className="flex flex-col gap-6">
      <SectionHeader title="Operations" detail="Provider connections and ingest activity, separate from customer-facing results." />
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
    </PageShell>
  );
}

