"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import type { SkillGroupResult } from "./assessment-results-chart";
import type { BenchmarkData } from "./use-benchmarks";
import { useSkillBenchmarks } from "./use-skill-benchmarks";

export type SkillScore = {
  name: string;
  groupId: string;
  templateSkillId: string;
  maxPoints: number;
  rawScore: number;
};

function scoreToPercent(score: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((score / total) * 100);
}

function Donut({
  value,
  total,
  label,
}: {
  value: number;
  total: number;
  label: string;
}) {
  const radius = 44;
  const stroke = 12;
  const normalized = Math.min(Math.max(value, 0), total);
  const pct = total > 0 ? normalized / total : 0;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * pct;

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle
          cx="60"
          cy="60"
          r={radius}
          stroke="#E5E5E5"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          stroke="#004070"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
        />
        <text
          x="60"
          y="58"
          textAnchor="middle"
          fill="#00ABEB"
          fontSize="18"
          fontWeight="600"
        >
          {Math.round(normalized)}
        </text>
        <text x="60" y="76" textAnchor="middle" fill="#7A7A7A" fontSize="10">
          /{Math.round(total)}
        </text>
      </svg>
      <span className="text-sm font-semibold text-[#004070]">{label}</span>
    </div>
  );
}

export function ResultsSkillSidebar({
  open,
  onOpenChange,
  skillGroup,
  benchmark,
  skills,
  templateId,
  filters,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skillGroup: SkillGroupResult | null;
  benchmark?: BenchmarkData;
  skills: SkillScore[];
  templateId: string;
  filters: Record<string, string>;
}) {
  const hasFilters = Object.keys(filters).length > 0;
  const filterValues = Object.values(filters);
  const benchmarkLabel = hasFilters
    ? `the average for ${filterValues.join(", ")}`
    : "the global average";

  const userTotal = skillGroup?.totalPossible ?? 0;
  const userScore = skillGroup?.userScore ?? 0;
  const benchmarkScore = benchmark?.mean_score ?? 0;
  const benchmarkTotal = benchmark?.total_possible_points ?? 0;
  const userPct = scoreToPercent(userScore, userTotal);
  const benchmarkPct = scoreToPercent(benchmarkScore, benchmarkTotal);
  const pctDiff = userPct - benchmarkPct;
  const skillBenchmarks = useSkillBenchmarks({
    skills,
    templateId,
    filters,
    enabled: open,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <div className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>{skillGroup?.name ?? "Skill Group"}</SheetTitle>
          </SheetHeader>

          <div className="mt-6 flex-1 overflow-y-auto pr-2">
            <div className="grid grid-cols-2 gap-4">
              <Donut value={userScore} total={userTotal} label="Your Score" />
              <Donut
                value={benchmarkScore}
                total={benchmarkTotal}
                label={hasFilters ? "Filtered Average" : "Global Average"}
              />
            </div>

            <div className="mt-8">
              <h3 className="text-sm font-semibold text-[#004070]">
                Insight Summary
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                You scored {Math.round(userScore)}/{Math.round(userTotal)} in this
                group ({userPct}%). That is{" "}
                {pctDiff >= 0
                  ? `${pctDiff}% higher`
                  : `${Math.abs(pctDiff)}% lower`}{" "}
                than {benchmarkLabel}.
              </p>
              <div className="mt-4 text-sm text-[#004070]">
                <div>1. Strength areas:</div>
                <div>2. Focus areas:</div>
              </div>
            </div>

            <div className="mt-8">
              <h3 className="mb-3 text-sm font-semibold text-[#004070]">
                Question Breakdown
              </h3>
              {skills.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No skills found for this group.
                </p>
              ) : (
                <Accordion type="multiple" className="w-full">
                  {skills.map((skill, index) => {
                    const mean =
                      skillBenchmarks[skill.templateSkillId]?.mean_score;
                    const userRounded = Math.round(skill.rawScore);
                    const meanRounded =
                      mean == null ? null : Math.round(Number(mean));
                    const userColor =
                      meanRounded == null
                        ? "text-muted-foreground"
                        : userRounded > meanRounded
                        ? "text-green-600"
                        : userRounded < meanRounded
                        ? "text-red-500"
                        : "text-muted-foreground";
                    const avgColor =
                      meanRounded == null
                        ? "text-muted-foreground"
                        : userRounded < meanRounded
                        ? "text-green-600"
                        : userRounded > meanRounded
                        ? "text-red-500"
                        : "text-muted-foreground";

                    return (
                      <AccordionItem key={skill.name} value={`q-${index}`}>
                        <AccordionTrigger className="text-[#004070]">
                          {skill.name}
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="flex items-center justify-between text-sm">
                            <span>Your Score</span>
                            <Badge variant="outline">
                              <span className={userColor}>
                                {skill.maxPoints > 0
                                  ? `${Math.round(skill.rawScore)}/${Math.round(
                                      skill.maxPoints
                                    )}`
                                  : "--"}
                              </span>
                            </Badge>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-sm">
                            <span>Average Score</span>
                            <Badge variant="outline">
                              <span className={avgColor}>
                                {skillBenchmarks[skill.templateSkillId]
                                  ?.mean_score != null
                                  ? `${Math.round(
                                      Number(
                                        skillBenchmarks[skill.templateSkillId]
                                          ?.mean_score
                                      )
                                    )}/${Math.round(skill.maxPoints)}`
                                  : "--"}
                              </span>
                            </Badge>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
