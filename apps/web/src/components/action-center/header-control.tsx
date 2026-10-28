import { ListChecks } from "lucide-react";
import { useActionCenter } from "../../action-center-context";
import { Button } from "../ui/button";

export function NextStepsHeaderControl() {
  const { view, loading, setOpen } = useActionCenter();
  if (loading && !view) return null;
  if (!view) return null;
  const count = view.selection.visibleCount;
  return (
    <Button variant="outline" className="min-h-11 gap-2 text-sm" onClick={() => setOpen(true)}>
      <ListChecks className="h-4 w-4 shrink-0 opacity-80" aria-hidden="true" />
      {count > 0 ? `Next Steps · ${count}` : "Next Steps"}
    </Button>
  );
}
