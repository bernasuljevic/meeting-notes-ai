// web/src/components/MeetingHistorySkeleton.tsx
import { Skeleton } from "@/components/ui/skeleton";

export function MeetingHistorySkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="flex items-start gap-3 border-b border-slate-100 p-3.5 dark:border-slate-800"
        >
          <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
