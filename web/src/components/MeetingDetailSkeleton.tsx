// web/src/components/MeetingDetailSkeleton.tsx
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function MeetingDetailSkeleton() {
  return (
    <div className="space-y-5">
      <Card className="overflow-hidden py-0 shadow-sm">
        <CardHeader className="border-b bg-gradient-to-r from-slate-900 to-blue-900 py-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-xl bg-white/10" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-48 bg-white/15" />
              <Skeleton className="h-3 w-28 bg-white/10" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex gap-2 bg-slate-50/60 py-3 dark:bg-slate-800/40">
          <Skeleton className="h-7 w-40 rounded-full" />
          <Skeleton className="h-7 w-40 rounded-full" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-16 rounded-2xl" />
        ))}
      </div>

      <Skeleton className="h-9 w-64 rounded-xl" />

      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} className="gap-3 py-4">
            <CardHeader className="px-4">
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="space-y-2 px-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
