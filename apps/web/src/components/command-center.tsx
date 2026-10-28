import { useEffect, useState } from "react";
import {
  trackChartPeriodChanged,
  trackFunnelViewed,
  trackInsightOpened,
  trackRecommendationOpened,
  trackResultScoreViewed,
  trackScoreComponentOpened,
} from "../analytics";
import type { LeadCapturePicture } from "../lead-capture-score";
import { formatWhen } from "../format";
import { StatusBadge, type StatusTone } from "./ui/badge";
import { AppCard } from "./ui/card";
import { KpiTile } from "./ui/kpi";
import { cn } from "../lib/cn";

export type ScorePeriod = 30 | 60 | 90;

const PERIODS: ScorePeriod[] = [30, 60, 90];

export function CommandCenterScore({
  picture,
  days,
  onDays,
  detail = "full",
}: {
  picture: LeadCapturePicture;
  days: ScorePeriod;
  onDays: (days: ScorePeriod) => void;
  detail?: "home" | "full";
}) {
  const home = detail === "home";
  const [openComponent, setOpenComponent] = useState<string | null>(null);
  const [openInsight, setOpenInsight] = useState<string | null>(null);
  const [openRecommendation, setOpenRecommendation] = useState<string | null>(null);
  const score = picture.result.overallScore;
  const status = picture.result.status;

  useEffect(() => {
    trackResultScoreViewed(score === null ? "insufficient" : "scored", status);
  }, [score, status]);

  const funnelKey = picture.funnel?.map((stage) => `${stage.id}:${stage.count}`).join("|") ?? "";
  useEffect(() => {
    if (funnelKey) trackFunnelViewed();
  }, [funnelKey]);

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="kpi-heading" className="space-y-3">
        <h2 id="kpi-heading" className="text-xs font-medium text-foreground-muted">Results</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {picture.kpis.map((kpi) => (
            <KpiTile
              key={kpi.id}
              label={kpi.label}
              value={kpi.value}
              hint={`This period · ${trendText(kpi.trend, kpi.change, kpi.changePercent, kpi.previous)}`}
              href={kpi.href}
            />
          ))}
        </div>
      </section>

      <AppCard
        className={cn(home ? "border-border/60 bg-muted/20 p-5 shadow-none" : "p-6 md:p-8")}
        aria-labelledby="result-score-heading"
      >
        <h2 id="result-score-heading" className="text-xs font-medium text-foreground-muted">Performance score</h2>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className={cn("font-bold tracking-tight text-foreground", home ? "text-3xl" : "text-4xl sm:text-5xl")}>
              {score === null ? "Not scored yet" : score}
              {score === null ? null : <span className="text-lg font-semibold text-foreground-muted"> / 100</span>}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{picture.result.explanation}</p>
          </div>
          <div className="flex flex-col items-start gap-2">
            <StatusBadge tone={statusToneFor(status)}>{status}</StatusBadge>
            <p className="text-sm text-foreground-muted">
              {picture.result.scoreChange === null
                ? `No previous score for the prior ${days} days.`
                : `${picture.result.scoreChange > 0 ? "+" : ""}${picture.result.scoreChange} over the previous ${days} days.`}
            </p>
            <p className="text-sm text-foreground-muted">Updated {formatWhen(picture.result.calculatedAt)}</p>
          </div>
        </div>
      </AppCard>

      <section aria-labelledby="period-heading" className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="period-heading" className="text-sm font-semibold text-foreground-muted">{home ? "Activity" : "Trends"}</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Chart period">
            {PERIODS.map((period) => (
              <button
                key={period}
                type="button"
                aria-pressed={days === period}
                className={`min-h-11 rounded-md border px-3 text-sm font-medium ${days === period ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"}`}
                onClick={() => {
                  if (days === period) return;
                  trackChartPeriodChanged(String(period));
                  onDays(period);
                }}
              >
                {period} days
              </button>
            ))}
          </div>
        </div>
        <div className={home ? "grid gap-3" : "grid gap-3 lg:grid-cols-2"}>
          {!home ? (
            <AppCard className="min-w-0 p-4">
              <h3 className="text-sm font-semibold">Score over time</h3>
              <p className="mt-3 text-sm text-foreground-muted">
                Score history will appear here after more reporting periods are recorded.
              </p>
            </AppCard>
          ) : null}
          <AppCard className="min-w-0 p-4">
            <h3 className="text-sm font-semibold">Leads and appointments</h3>
            <ActivityChart days={picture.days} />
          </AppCard>
        </div>
      </section>

      {!home ? (
      <section aria-labelledby="breakdown-heading" className="space-y-3">
        <h2 id="breakdown-heading" className="text-sm font-semibold text-foreground-muted">Score breakdown</h2>
        <AppCard className="p-4">
          <ul className="space-y-4">
            {picture.result.components.map((item) => {
              const open = openComponent === item.id;
              return (
                <li key={item.id} className="min-w-0">
                  <button
                    type="button"
                    className="flex w-full min-w-0 flex-col gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center"
                    aria-expanded={open}
                    onClick={() => {
                      trackScoreComponentOpened(item.id);
                      setOpenComponent(open ? null : item.id);
                    }}
                  >
                    <span className="w-full shrink-0 text-sm font-medium sm:w-52">{item.name}</span>
                    <span className="h-2 min-w-0 flex-1 rounded-full bg-muted" aria-hidden="true">
                      <span
                        className="block h-2 rounded-full bg-primary"
                        style={{ width: `${item.score ?? 0}%` }}
                      />
                    </span>
                    <span className="text-sm font-semibold tabular-nums">{item.score === null ? "Not measured" : item.score}</span>
                  </button>
                  {open ? <p className="mt-2 text-sm text-foreground-muted">{item.insufficientReason ?? item.explanation}</p> : null}
                </li>
              );
            })}
          </ul>
        </AppCard>
      </section>
      ) : null}

      {picture.funnel ? (
        <section aria-labelledby="funnel-heading" className="space-y-3">
          <h2 id="funnel-heading" className="text-sm font-semibold text-foreground-muted">Lead funnel</h2>
          <AppCard className="p-4">
            <ol className="grid gap-3 sm:grid-cols-3">
              {picture.funnel.map((stage) => (
                <li key={stage.id} className="min-w-0 rounded-md border border-border p-3">
                  <p className="truncate text-sm text-foreground-muted">{stage.label}</p>
                  <p className="mt-1 text-2xl font-bold">{stage.count}</p>
                  <p className="mt-1 text-sm text-foreground-muted">
                    {stage.fromPrevious === null ? "Starting count" : `${stage.fromPrevious}% of the previous stage`}
                  </p>
                </li>
              ))}
            </ol>
          </AppCard>
        </section>
      ) : (
        <section aria-labelledby="funnel-heading">
          <h2 id="funnel-heading" className="text-sm font-semibold text-foreground-muted">Lead funnel</h2>
          <p className="mt-2 text-sm text-foreground-muted">No leads were recorded in this period, so the funnel is hidden.</p>
        </section>
      )}

      {!home ? (
      <section aria-labelledby="insights-heading" className="space-y-3">
        <h2 id="insights-heading" className="text-sm font-semibold text-foreground-muted">Insights</h2>
        <ul className="space-y-3">
          {picture.insights.map((insight) => {
            const open = openInsight === insight.id;
            return (
              <li key={insight.id}>
                <AppCard className="p-4">
                  <button
                    type="button"
                    className="w-full break-words text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-expanded={open}
                    onClick={() => {
                      trackInsightOpened(insight.id);
                      setOpenInsight(open ? null : insight.id);
                    }}
                  >
                    {insight.summary}
                  </button>
                  {open ? <p className="mt-2 text-sm text-foreground-muted">{insight.detail}</p> : null}
                </AppCard>
              </li>
            );
          })}
        </ul>
      </section>
      ) : null}

      {!home ? (
      <section aria-labelledby="attention-heading" className="space-y-3">
        <h2 id="attention-heading" className="text-sm font-semibold text-foreground-muted">Attention required</h2>
        <ul className="space-y-3">
          {picture.recommendations.map((item) => {
            const open = openRecommendation === item.id;
            return (
              <li key={item.id}>
                <AppCard className="p-4">
                  <button
                    type="button"
                    className="w-full break-words text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-expanded={open}
                    onClick={() => {
                      trackRecommendationOpened(item.id);
                      setOpenRecommendation(open ? null : item.id);
                    }}
                  >
                    {item.title}
                  </button>
                  {open ? <p className="mt-2 text-sm text-foreground-muted">{item.why}</p> : null}
                </AppCard>
              </li>
            );
          })}
        </ul>
      </section>
      ) : null}
    </div>
  );
}

function ActivityChart({ days }: { days: LeadCapturePicture["days"] }) {
  const max = Math.max(1, ...days.map((day) => Math.max(day.leads, day.appointments)));
  const width = 100;
  const height = 36;
  const leads = pathFor(days.map((day) => day.leads), max, width, height);
  const appointments = pathFor(days.map((day) => day.appointments), max, width, height);
  const totalLeads = days.reduce((sum, day) => sum + day.leads, 0);
  const totalAppointments = days.reduce((sum, day) => sum + day.appointments, 0);
  return (
    <div className="mt-3 min-w-0">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Daily leads and appointments" className="h-36 w-full">
        <title>Daily leads and appointments</title>
        <polyline fill="none" stroke="#6E7B87" strokeWidth="1.2" points={leads} />
        <polyline fill="none" stroke="#2F6B9A" strokeWidth="1.2" points={appointments} />
      </svg>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground-muted">
        <span>Leads {totalLeads}</span>
        <span>Appointments {totalAppointments}</span>
      </p>
      {totalLeads === 0 && totalAppointments === 0 ? (
        <p className="mt-1 text-sm text-foreground-muted">No leads or appointments in this period.</p>
      ) : null}
    </div>
  );
}

function pathFor(values: number[], max: number, width: number, height: number): string {
  if (values.length === 0) return "";
  return values.map((value, index) => {
    const x = values.length === 1 ? 0 : (index / (values.length - 1)) * width;
    const y = height - (value / max) * (height - 2) - 1;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

function trendText(trend: "up" | "down" | "flat" | "unknown", change: number, changePercent: number | null, previous: number): string {
  if (trend === "flat") return `No change from ${previous}`;
  const direction = trend === "up" ? "Up" : "Down";
  const amount = Math.abs(change);
  const percent = changePercent === null ? "" : ` (${changePercent > 0 ? "+" : ""}${changePercent}%)`;
  return `${direction} ${amount} from ${previous}${percent}`;
}

function statusToneFor(status: string): StatusTone {
  if (status === "Excellent" || status === "Good") return "success";
  if (status === "Watch") return "warning";
  if (status === "At Risk" || status === "Critical") return "error";
  return "muted";
}
