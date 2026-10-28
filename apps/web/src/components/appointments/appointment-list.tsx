import { StatusBadge, statusTone } from "../ui/badge";
import { EmptyState } from "../ui/states";
import { formatWhen } from "../../format";

export interface AppointmentRow {
  appointmentId: string;
  status: string;
  provider: string;
  startAt: string;
}

export function AppointmentList({
  items,
  showProvider = false,
  emptyTitle = "No appointments yet",
  emptyDetail = "Booked appointments will appear here.",
}: {
  items: AppointmentRow[];
  showProvider?: boolean;
  emptyTitle?: string;
  emptyDetail?: string;
}) {
  if (items.length === 0) {
    return <EmptyState title={emptyTitle} detail={emptyDetail} />;
  }

  return (
    <>
      <ul className="divide-y divide-border md:hidden">
        {items.map((item) => (
          <li key={item.appointmentId} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
            <p className="font-medium text-foreground">{formatWhen(item.startAt)}</p>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={statusTone(item.status)}>{item.status}</StatusBadge>
              {showProvider ? <span className="text-sm text-foreground-muted">{item.provider}</span> : null}
            </div>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {["When", "Status", ...(showProvider ? ["Provider"] : [])].map((header) => (
                <th key={header} scope="col" className="border-b border-border px-3 py-2 text-left text-xs font-semibold text-foreground-muted">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&_td]:border-b [&_td]:border-border [&_td]:px-3 [&_td]:py-3">
            {items.map((item) => (
              <tr key={item.appointmentId}>
                <td>{formatWhen(item.startAt)}</td>
                <td>
                  <StatusBadge tone={statusTone(item.status)}>{item.status}</StatusBadge>
                </td>
                {showProvider ? <td>{item.provider}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
