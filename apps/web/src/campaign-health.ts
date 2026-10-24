export interface CampaignRecord {
  campaignId: string;
  name: string;
  channel: string;
  status: string;
}

export interface CampaignAppointment {
  campaignId: string | null;
  startAt: string;
}

export type CampaignVerdictLabel = "Working" | "No bookings this period" | "Archived";

export interface CampaignVerdict {
  campaignId: string;
  name: string;
  channel: string;
  status: string;
  bookings: number;
  latestBookingAt: string | null;
  verdict: CampaignVerdictLabel;
}

export interface CampaignHealth {
  campaigns: CampaignVerdict[];
  unattributedBookings: number;
  unattributedLatestBookingAt: string | null;
}

function inWindow(startAt: string, bounds: { from: string; to: string }): boolean {
  return Boolean(startAt) && startAt >= bounds.from && startAt < bounds.to;
}

function latest(times: string[]): string | null {
  if (times.length === 0) return null;
  return times.reduce((current, next) => (next > current ? next : current));
}

export function campaignHealth(
  campaigns: CampaignRecord[],
  appointments: CampaignAppointment[],
  bounds: { from: string; to: string },
): CampaignHealth {
  const inPeriod = appointments.filter((item) => inWindow(item.startAt, bounds));
  const unattributed = inPeriod.filter((item) => !item.campaignId);
  const campaignsResult = [...campaigns]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((campaign) => {
      const matched = inPeriod.filter((item) => item.campaignId === campaign.campaignId);
      const bookings = matched.length;
      const verdict: CampaignVerdictLabel = campaign.status === "archived"
        ? "Archived"
        : campaign.status === "active" && bookings > 0
          ? "Working"
          : "No bookings this period";
      return {
        campaignId: campaign.campaignId,
        name: campaign.name,
        channel: campaign.channel,
        status: campaign.status,
        bookings,
        latestBookingAt: latest(matched.map((item) => item.startAt)),
        verdict,
      };
    });
  return {
    campaigns: campaignsResult,
    unattributedBookings: unattributed.length,
    unattributedLatestBookingAt: latest(unattributed.map((item) => item.startAt)),
  };
}
