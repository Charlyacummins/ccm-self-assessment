"use client";

interface CorpChartKeyBarProps {
  subjectLabel?: string;
}

export function CorpChartKeyBar({ subjectLabel = "You" }: CorpChartKeyBarProps) {
  return (
    <div className="mt-4 inline-flex items-center gap-4 rounded-lg border px-4 py-2 text-xs">
      <span className="font-medium text-muted-foreground">Key</span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-sm bg-[#004070]" />
        {subjectLabel}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-sm bg-[#00ABEB]" />
        Benchmark
      </span>
    </div>
  );
}
