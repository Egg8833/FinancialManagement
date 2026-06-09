"use client";

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
  );
}

export function ChartSkeleton({ height = 'h-48' }: { height?: string }) {
  return (
    <div className={`${height} bg-gray-50 border border-gray-100 rounded-2xl p-4 flex flex-col justify-end gap-2`}>
      <div className="flex items-end gap-2 h-full">
        {[60, 40, 75, 55, 80, 45, 65, 70, 50, 85, 60, 90].map((h, i) => (
          <div
            key={i}
            className="flex-1 animate-pulse bg-gray-200 rounded-t"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-8" />
        ))}
      </div>
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-gray-50">
      <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
      <div className="flex-1 flex gap-4">
        {Array.from({ length: cols - 1 }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
    </div>
  );
}

export function KPISkeleton() {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <Skeleton className="h-4 w-24 mb-3" />
      <Skeleton className="h-8 w-32 mb-2" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}
