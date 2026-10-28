import { useActionCenter } from "../../action-center-context";
import { Button } from "../ui/button";

export function NextStepsHeaderControl() {
  const { view, loading, setOpen } = useActionCenter();
  if (loading && !view) return null;
  const count = view?.selection.visibleCount ?? 0;
  if (!view || count === 0) return null;
  return (
    <Button variant="outline" className="min-h-11 text-sm" onClick={() => setOpen(true)}>
      Next Steps · {count}
    </Button>
  );
}
