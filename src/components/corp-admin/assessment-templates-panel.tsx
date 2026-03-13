"use client";

import { type FormEvent, useEffect, useState } from "react";
import type { TemplateOption } from "./manage-assessments-content";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import type { CohortOverviewData } from "@/app/api/corp-admin/cohort-overview/route";
import type { CohortCustomQuestionsData } from "@/app/api/corp-admin/cohort-custom-questions/route";
import type { CohortQuestionSetData } from "@/app/api/corp-admin/cohort-question-set/route";
import type { CohortRemovedQuestionsData } from "@/app/api/corp-admin/cohort-removed-questions/route";
import {
  Maximize2,
  Minimize2,
  FileText,
  Eye,
  Plus,
  Trash2,
  ChevronDown,
  ChevronsUpDown,
} from "lucide-react";

type CohortLifecycleStatus = "Draft" | "Active" | "Completed";

function normalizeCohortStatus(status: string | null | undefined): CohortLifecycleStatus {
  const normalized = (status ?? "").trim().toLowerCase();
  if (normalized === "active") return "Active";
  if (normalized === "completed" || normalized === "ended") return "Completed";
  return "Draft";
}

// ─── Template selector ───────────────────────────────────────────────────────

function TemplateSelector({
  value,
  onChange,
  options,
  iconVariant = "down",
}: {
  value: string;
  onChange: (v: string) => void;
  options: TemplateOption[];
  iconVariant?: "down" | "updown";
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-full border border-gray-200 bg-gray-50 px-4 py-2 pr-8 text-sm font-medium text-[#004070] focus:outline-none focus:ring-2 focus:ring-[#00ABEB]"
      >
        {options.length === 0 ? (
          <option value="">No templates available</option>
        ) : (
          options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))
        )}
      </select>
      {iconVariant === "updown" ? (
        <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#004070]" />
      ) : (
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#004070]" />
      )}
    </div>
  );
}

// ─── Overview table ──────────────────────────────────────────────────────────

function OverviewTable({
  overview,
  loading,
}: {
  overview: CohortOverviewData | null;
  loading: boolean;
}) {
  const questions = loading ? "..." : String(overview?.questions ?? 0);
  const invitees = loading ? "..." : String(overview?.invitees ?? 0);
  const statusText = loading ? "Loading..." : (overview?.status ?? "—");
  const statusClass =
    statusText.toLowerCase() === "draft"
      ? "text-red-500"
      : statusText === "Loading..."
        ? "text-muted-foreground"
        : "text-[#004070]";

  return (
    <div>
      <p className="mb-2 text-center text-xs text-muted-foreground">Overview</p>
      <div className="grid grid-cols-3 divide-x rounded-md border text-center text-xs">
        <div className="px-2 py-2 font-medium text-[#004070]">Questions</div>
        <div className="px-2 py-2 font-medium text-[#004070]">Status</div>
        <div className="px-2 py-2 font-medium text-[#004070]">Invitees</div>
        <div className="border-t px-2 py-2 text-[#004070]">{questions}</div>
        <div className={`border-t px-2 py-2 font-semibold ${statusClass}`}>{statusText}</div>
        <div className="border-t px-2 py-2 text-[#004070]">{invitees}</div>
      </div>
    </div>
  );
}

// ─── Question Set row ────────────────────────────────────────────────────────

function QuestionSetRow({ onViewEdit }: { onViewEdit: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <div className="flex items-center gap-2 text-sm font-medium text-[#004070]">
        <FileText className="h-4 w-4 shrink-0" />
        <span>CCMI Self Assessment</span>
      </div>
      <button onClick={onViewEdit} className="text-xs text-[#00ABEB] hover:underline">
        View/Edit
      </button>
    </div>
  );
}

// ─── Reviewers row ───────────────────────────────────────────────────────────

function ReviewersRow({ reviewersEnabled }: { reviewersEnabled: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <div className="flex items-center gap-2 text-sm font-medium text-[#004070]">
        <Eye className="h-4 w-4 shrink-0" />
        <span>Enable Reviewers</span>
      </div>
      <div className="relative">
        <select
          value={reviewersEnabled ? "enabled" : "disabled"}
          disabled
          aria-label="Reviewer setting"
          className="appearance-none rounded border border-gray-200 bg-gray-50 px-3 py-1 pr-6 text-xs text-[#004070] opacity-100 disabled:cursor-default disabled:opacity-100"
        >
          <option value="disabled">Disabled</option>
          <option value="enabled">Enabled</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-1 top-1/2 h-3 w-3 -translate-y-1/2 text-[#004070]" />
      </div>
    </div>
  );
}

// ─── Expanded dialog content ─────────────────────────────────────────────────

function ExpandedContent({
  template,
  onTemplateChange,
  options,
  overview,
  overviewLoading,
  onOpenQuestionSet,
  customQuestions,
  customQuestionsLoading,
  onOpenAddCustomQuestion,
  onEditCustomQuestion,
  removedQuestions,
  removedQuestionsLoading,
  onRestoreQuestion,
  restoringQuestionId,
  statusActionLabel,
  onStatusAction,
  statusActionLoading,
  statusActionError,
  cohortStatus,
}: {
  template: string;
  onTemplateChange: (v: string) => void;
  options: TemplateOption[];
  overview: CohortOverviewData | null;
  overviewLoading: boolean;
  onOpenQuestionSet: () => void;
  customQuestions: CohortCustomQuestionsData["questions"];
  customQuestionsLoading: boolean;
  onOpenAddCustomQuestion: () => void;
  onEditCustomQuestion: (question: CohortCustomQuestionsData["questions"][number]) => void;
  removedQuestions: CohortRemovedQuestionsData["questions"];
  removedQuestionsLoading: boolean;
  onRestoreQuestion: (templateSkillId: string) => void;
  restoringQuestionId: string | null;
  statusActionLabel: string | null;
  onStatusAction: () => void;
  statusActionLoading: boolean;
  statusActionError: string | null;
  cohortStatus: CohortLifecycleStatus | null;
}) {
  const reviewersEnabled = overview?.reviewersEnabled ?? false;
  const questionsLocked = cohortStatus === "Active" || cohortStatus === "Completed";

  return (
    <div className="space-y-6">
      {/* Template selector — centered */}
      <div className="mx-auto max-w-sm">
        <TemplateSelector value={template} onChange={onTemplateChange} options={options} iconVariant="updown" />
      </div>

      {/* Overview */}
      <div className="mx-auto max-w-sm">
        <OverviewTable overview={overview} loading={overviewLoading} />
        {statusActionLabel ? (
          <div className="mt-3 space-y-2">
            <Button
              type="button"
              onClick={onStatusAction}
              disabled={statusActionLoading}
              className="w-full bg-[#004070] text-white hover:bg-[#003560] disabled:opacity-50"
            >
              {statusActionLoading ? "Updating..." : statusActionLabel}
            </Button>
            {statusActionError ? (
              <p className="text-xs text-red-500">{statusActionError}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Question Set + Reviewers side by side */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-[#534F4F]">Question Set</p>
          <QuestionSetRow onViewEdit={onOpenQuestionSet} />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-[#534F4F]">Reviewers</p>
          <ReviewersRow reviewersEnabled={reviewersEnabled} />
        </div>
      </div>

      {/* Custom Questions */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-[#534F4F]">Custom Questions</p>
          {!questionsLocked && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onOpenAddCustomQuestion}
              className="h-7 border-[#00ABEB] px-2 text-xs text-[#004070]"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add Custom Question
            </Button>
          )}
        </div>
          <div className="rounded-md border">
            <ol className="divide-y">
              {customQuestionsLoading ? (
                <li className="px-4 py-3 text-xs text-muted-foreground">Loading custom questions...</li>
              ) : customQuestions.length === 0 ? (
                <li className="px-4 py-3 text-xs text-muted-foreground">No custom questions for this cohort.</li>
              ) : (
                customQuestions.map((q, i) => (
                  <li key={q.id} className="flex items-start gap-4 px-4 py-3 text-xs">
                    <span className="shrink-0 text-[#534F4F]">{i + 1}.</span>
                    <div className="flex-1 space-y-0.5">
                      <p className="font-medium text-[#004070]">{q.text}</p>
                      {q.description ? (
                        <p className="text-muted-foreground">{q.description}</p>
                      ) : null}
                      <p className="text-muted-foreground">
                        Possible answers: {q.answerOptions.length
                          ? q.answerOptions.map((option) => `${option.responseText} (${option.pointValue})`).join(", ")
                          : "—"}
                      </p>
                    </div>
                    <button
                      onClick={() => onEditCustomQuestion(q)}
                      className="shrink-0 text-[#00ABEB] hover:underline"
                    >
                      Edit
                    </button>
                  </li>
                ))
              )}
            </ol>
          </div>
      </div>

      {/* Removed Questions */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-[#534F4F]">Removed Questions</p>
        <div className="rounded-md border">
          {removedQuestionsLoading ? (
            <p className="px-4 py-3 text-xs text-muted-foreground">Loading removed questions...</p>
          ) : removedQuestions.length === 0 ? (
            <p className="px-4 py-3 text-xs text-muted-foreground">No removed questions.</p>
          ) : (
            <ol className="divide-y">
              {removedQuestions.map((q, i) => (
                <li key={q.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="shrink-0 text-xs text-[#534F4F]">{i + 1}.</span>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-[#004070]">{q.name}</p>
                    {q.description ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{q.description}</p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onRestoreQuestion(q.id)}
                    disabled={restoringQuestionId === q.id}
                    className="h-7 border-[#00ABEB] px-2 text-xs text-[#004070]"
                  >
                    {restoringQuestionId === q.id ? "Restoring..." : "Restore"}
                  </Button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function AssessmentTemplatesPanel({
  templateOptions = [],
  selectedCohortId,
  onCohortChange,
  settingsVersion = 0,
}: {
  templateOptions?: TemplateOption[];
  selectedCohortId: string;
  onCohortChange: (v: string) => void;
  settingsVersion?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [questionSetOpen, setQuestionSetOpen] = useState(false);
  const [overview, setOverview] = useState<CohortOverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [questionSet, setQuestionSet] = useState<CohortQuestionSetData | null>(null);
  const [questionSetLoading, setQuestionSetLoading] = useState(false);
  const [questionSetError, setQuestionSetError] = useState<string | null>(null);
  const [customQuestions, setCustomQuestions] = useState<CohortCustomQuestionsData["questions"]>([]);
  const [customQuestionsLoading, setCustomQuestionsLoading] = useState(false);
  const [customQuestionModalOpen, setCustomQuestionModalOpen] = useState(false);
  const [editCustomQuestionModalOpen, setEditCustomQuestionModalOpen] = useState(false);
  const [editCustomQuestionId, setEditCustomQuestionId] = useState<string | null>(null);
  const [customQuestionError, setCustomQuestionError] = useState<string | null>(null);
  const [customQuestionSaving, setCustomQuestionSaving] = useState(false);
  const [customQuestionDeleting, setCustomQuestionDeleting] = useState(false);
  const [editCustomQuestionError, setEditCustomQuestionError] = useState<string | null>(null);
  const [questionRemovingId, setQuestionRemovingId] = useState<string | null>(null);
  const [questionRestoringId, setQuestionRestoringId] = useState<string | null>(null);
  const [questionActionError, setQuestionActionError] = useState<string | null>(null);
  const [removedQuestions, setRemovedQuestions] = useState<CohortRemovedQuestionsData["questions"]>([]);
  const [removedQuestionsLoading, setRemovedQuestionsLoading] = useState(false);
  const [cohortStatusSaving, setCohortStatusSaving] = useState(false);
  const [cohortStatusError, setCohortStatusError] = useState<string | null>(null);
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const [uncompletedInvitees, setUncompletedInvitees] = useState(0);
  const [newCustomQuestion, setNewCustomQuestion] = useState({
    name: "",
    questionText: "",
    answerOptions: [
      { responseText: "", pointValue: "0" },
      { responseText: "", pointValue: "0" },
    ],
  });
  const [editingCustomQuestion, setEditingCustomQuestion] = useState({
    name: "",
    questionText: "",
    answerOptions: [
      { responseText: "", pointValue: "0" },
      { responseText: "", pointValue: "0" },
    ],
  });

  useEffect(() => {
    setCohortStatusError(null);
    setConfirmEndOpen(false);
    setUncompletedInvitees(0);
    if (!selectedCohortId) {
      setOverview(null);
      return;
    }

    const controller = new AbortController();
    setOverviewLoading(true);

    fetch(`/api/corp-admin/cohort-overview?cohortId=${encodeURIComponent(selectedCohortId)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load cohort overview");
        return (await res.json()) as CohortOverviewData;
      })
      .then((data) => setOverview(data))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setOverview(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setOverviewLoading(false);
      });

    return () => controller.abort();
  }, [selectedCohortId, settingsVersion]);

  useEffect(() => {
    if (!selectedCohortId) {
      setCustomQuestions([]);
      return;
    }

    const controller = new AbortController();
    setCustomQuestionsLoading(true);

    fetch(
      `/api/corp-admin/cohort-custom-questions?cohortId=${encodeURIComponent(selectedCohortId)}`,
      { signal: controller.signal }
    )
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load custom questions");
        return (await res.json()) as CohortCustomQuestionsData;
      })
      .then((data) => setCustomQuestions(data.questions ?? []))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setCustomQuestions([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCustomQuestionsLoading(false);
      });

    return () => controller.abort();
  }, [selectedCohortId]);

  useEffect(() => {
    if (!selectedCohortId) {
      setRemovedQuestions([]);
      return;
    }

    const controller = new AbortController();
    setRemovedQuestionsLoading(true);

    fetch(
      `/api/corp-admin/cohort-removed-questions?cohortId=${encodeURIComponent(selectedCohortId)}`,
      { signal: controller.signal }
    )
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load removed questions");
        return (await res.json()) as CohortRemovedQuestionsData;
      })
      .then((data) => setRemovedQuestions(data.questions ?? []))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setRemovedQuestions([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setRemovedQuestionsLoading(false);
      });

    return () => controller.abort();
  }, [selectedCohortId]);

  useEffect(() => {
    setQuestionSet(null);
    setQuestionSetError(null);
  }, [selectedCohortId]);

  const loadQuestionSet = async () => {
    if (!selectedCohortId) return;

    setQuestionSetLoading(true);
    setQuestionSetError(null);
    try {
      const res = await fetch(
        `/api/corp-admin/cohort-question-set?cohortId=${encodeURIComponent(selectedCohortId)}`
      );
      if (!res.ok) throw new Error("Failed to load question set");
      const data = (await res.json()) as CohortQuestionSetData;
      setQuestionSet(data);
    } catch {
      setQuestionSet(null);
      setQuestionSetError("Could not load question set.");
    } finally {
      setQuestionSetLoading(false);
    }
  };

  const handleOpenQuestionSet = () => {
    setQuestionSetOpen(true);
    if (!questionSet && !questionSetLoading) {
      void loadQuestionSet();
    }
  };

  const resetCustomQuestionDraft = () => {
    setNewCustomQuestion({
      name: "",
      questionText: "",
      answerOptions: [
        { responseText: "", pointValue: "0" },
        { responseText: "", pointValue: "0" },
      ],
    });
    setCustomQuestionError(null);
  };

  const resetEditCustomQuestionDraft = () => {
    setEditCustomQuestionId(null);
    setEditingCustomQuestion({
      name: "",
      questionText: "",
      answerOptions: [
        { responseText: "", pointValue: "0" },
        { responseText: "", pointValue: "0" },
      ],
    });
    setEditCustomQuestionError(null);
  };

  const handleOpenAddCustomQuestion = () => {
    setCustomQuestionModalOpen(true);
  };

  const handleOpenEditCustomQuestion = (
    question: CohortCustomQuestionsData["questions"][number]
  ) => {
    setEditCustomQuestionId(question.id);
    setEditingCustomQuestion({
      name: question.text ?? "",
      questionText: question.description ?? "",
      answerOptions:
        question.answerOptions.length > 0
          ? question.answerOptions.map((option) => ({
              responseText: option.responseText,
              pointValue: String(option.pointValue ?? 0),
            }))
          : [
              { responseText: "", pointValue: "0" },
              { responseText: "", pointValue: "0" },
            ],
    });
    setEditCustomQuestionError(null);
    setEditCustomQuestionModalOpen(true);
  };

  const refreshOverview = async () => {
    if (!selectedCohortId) return;
    setOverviewLoading(true);
    try {
      const res = await fetch(
        `/api/corp-admin/cohort-overview?cohortId=${encodeURIComponent(selectedCohortId)}`
      );
      if (!res.ok) throw new Error("Failed to refresh overview");
      const data = (await res.json()) as CohortOverviewData;
      setOverview(data);
    } finally {
      setOverviewLoading(false);
    }
  };

  const refreshCustomQuestions = async () => {
    if (!selectedCohortId) return;
    setCustomQuestionsLoading(true);
    try {
      const res = await fetch(
        `/api/corp-admin/cohort-custom-questions?cohortId=${encodeURIComponent(selectedCohortId)}`
      );
      if (!res.ok) throw new Error("Failed to refresh custom questions");
      const data = (await res.json()) as CohortCustomQuestionsData;
      setCustomQuestions(data.questions ?? []);
    } finally {
      setCustomQuestionsLoading(false);
    }
  };

  const refreshRemovedQuestions = async () => {
    if (!selectedCohortId) return;
    setRemovedQuestionsLoading(true);
    try {
      const res = await fetch(
        `/api/corp-admin/cohort-removed-questions?cohortId=${encodeURIComponent(selectedCohortId)}`
      );
      if (!res.ok) throw new Error("Failed to refresh removed questions");
      const data = (await res.json()) as CohortRemovedQuestionsData;
      setRemovedQuestions(data.questions ?? []);
    } finally {
      setRemovedQuestionsLoading(false);
    }
  };

  const handleCreateCustomQuestion = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedCohortId) return;

    setCustomQuestionSaving(true);
    setCustomQuestionError(null);
    setQuestionActionError(null);

    const responseOptions = newCustomQuestion.answerOptions
      .map((row) => ({
        responseText: row.responseText.trim(),
        pointValue: Number(row.pointValue),
      }))
      .filter((row) => row.responseText.length > 0);

    try {
      const res = await fetch("/api/corp-admin/cohort-custom-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cohortId: selectedCohortId,
          name: newCustomQuestion.name.trim(),
          questionText: newCustomQuestion.questionText.trim(),
          responseOptions,
        }),
      });

      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Failed to create custom question");

      await Promise.all([
        refreshCustomQuestions(),
        refreshRemovedQuestions(),
        refreshOverview(),
        loadQuestionSet(),
      ]);
      setCustomQuestionModalOpen(false);
      resetCustomQuestionDraft();
    } catch (error) {
      setCustomQuestionError(error instanceof Error ? error.message : "Could not create custom question.");
    } finally {
      setCustomQuestionSaving(false);
    }
  };

  const handleUpdateCustomQuestion = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedCohortId || !editCustomQuestionId) return;

    setCustomQuestionSaving(true);
    setEditCustomQuestionError(null);
    setQuestionActionError(null);

    const responseOptions = editingCustomQuestion.answerOptions
      .map((row) => ({
        responseText: row.responseText.trim(),
        pointValue: Number(row.pointValue),
      }))
      .filter((row) => row.responseText.length > 0);

    try {
      const res = await fetch("/api/corp-admin/cohort-custom-questions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cohortId: selectedCohortId,
          customSkillId: editCustomQuestionId,
          name: editingCustomQuestion.name.trim(),
          questionText: editingCustomQuestion.questionText.trim(),
          responseOptions,
        }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Failed to update custom question");

      await Promise.all([
        refreshCustomQuestions(),
        refreshRemovedQuestions(),
        refreshOverview(),
        loadQuestionSet(),
      ]);

      setEditCustomQuestionModalOpen(false);
      resetEditCustomQuestionDraft();
    } catch (error) {
      setEditCustomQuestionError(
        error instanceof Error ? error.message : "Could not update custom question."
      );
    } finally {
      setCustomQuestionSaving(false);
    }
  };

  const handleDeleteCustomQuestion = async () => {
    if (!selectedCohortId || !editCustomQuestionId) return;
    setCustomQuestionDeleting(true);
    setEditCustomQuestionError(null);
    setQuestionActionError(null);
    try {
      const res = await fetch("/api/corp-admin/cohort-custom-questions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cohortId: selectedCohortId,
          customSkillId: editCustomQuestionId,
        }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Failed to delete custom question");

      await Promise.all([
        refreshCustomQuestions(),
        refreshRemovedQuestions(),
        refreshOverview(),
        loadQuestionSet(),
      ]);

      setEditCustomQuestionModalOpen(false);
      resetEditCustomQuestionDraft();
    } catch (error) {
      setEditCustomQuestionError(
        error instanceof Error ? error.message : "Could not delete custom question."
      );
    } finally {
      setCustomQuestionDeleting(false);
    }
  };

  const handleRemoveExistingQuestion = async (templateSkillId: string) => {
    if (!selectedCohortId) return;
    setQuestionActionError(null);
    setQuestionRemovingId(templateSkillId);
    try {
      const res = await fetch("/api/corp-admin/cohort-custom-questions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cohortId: selectedCohortId,
          templateSkillId,
        }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Failed to remove question");

      await Promise.all([loadQuestionSet(), refreshOverview(), refreshRemovedQuestions()]);
    } catch (error) {
      setQuestionActionError(error instanceof Error ? error.message : "Could not remove question.");
    } finally {
      setQuestionRemovingId(null);
    }
  };

  const handleRestoreQuestion = async (templateSkillId: string) => {
    if (!selectedCohortId) return;
    setQuestionActionError(null);
    setQuestionRestoringId(templateSkillId);
    try {
      const res = await fetch("/api/corp-admin/cohort-custom-questions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cohortId: selectedCohortId,
          templateSkillId,
        }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Failed to restore question");

      await Promise.all([loadQuestionSet(), refreshOverview(), refreshRemovedQuestions()]);
    } catch (error) {
      setQuestionActionError(error instanceof Error ? error.message : "Could not restore question.");
    } finally {
      setQuestionRestoringId(null);
    }
  };

  const updateCohortStatus = async (nextStatus: CohortLifecycleStatus, force = false) => {
    if (!selectedCohortId) return;
    setCohortStatusSaving(true);
    setCohortStatusError(null);
    try {
      const res = await fetch("/api/corp-admin/cohort-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cohortId: selectedCohortId,
          status: nextStatus,
          force,
        }),
      });

      const payload = (await res.json()) as {
        error?: string;
        needsConfirmation?: boolean;
        uncompletedInvitees?: number;
      };

      if (!res.ok) {
        if (
          res.status === 409 &&
          payload.needsConfirmation &&
          nextStatus === "Completed" &&
          !force
        ) {
          setUncompletedInvitees(payload.uncompletedInvitees ?? 0);
          setConfirmEndOpen(true);
          return;
        }
        throw new Error(payload.error ?? "Failed to update cohort status");
      }

      setConfirmEndOpen(false);
      setUncompletedInvitees(0);
      await refreshOverview();
    } catch (error) {
      setCohortStatusError(error instanceof Error ? error.message : "Could not update cohort status.");
    } finally {
      setCohortStatusSaving(false);
    }
  };

  const currentStatus = overview ? normalizeCohortStatus(overview.status) : null;
  const questionsLocked = currentStatus === "Active" || currentStatus === "Completed";
  const statusActionLabel =
    !selectedCohortId || overviewLoading || !currentStatus
      ? null
      : currentStatus === "Draft"
        ? "Make Active"
        : currentStatus === "Active"
          ? "End Testing"
          : null;

  const groupedQuestions = (questionSet?.questions ?? []).reduce<
    Array<{ groupName: string; items: CohortQuestionSetData["questions"] }>
  >((acc, q) => {
    const groupName = q.skillGroupName ?? "Ungrouped";
    const existing = acc.find((g) => g.groupName === groupName);
    if (existing) {
      existing.items.push(q);
    } else {
      acc.push({ groupName, items: [q] });
    }
    return acc;
  }, []);

  return (
    <>
      {/* ── Compact card ── */}
      <Card className="flex flex-col h-full">
        <CardHeader className="relative flex items-center justify-center pb-3">
          <CardTitle className="text-base text-[#004070]">Assessment Templates</CardTitle>
          <button
            onClick={() => setExpanded(true)}
            className="absolute right-6 text-muted-foreground hover:text-[#004070]"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </CardHeader>

        <CardContent className="flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto pt-1">
          <TemplateSelector value={selectedCohortId} onChange={onCohortChange} options={templateOptions} />

          <OverviewTable overview={overview} loading={overviewLoading} />
          {statusActionLabel ? (
            <div className="space-y-2">
              <Button
                type="button"
                onClick={() =>
                  void updateCohortStatus(currentStatus === "Draft" ? "Active" : "Completed")
                }
                disabled={cohortStatusSaving || !selectedCohortId}
                className="w-full bg-[#004070] text-white hover:bg-[#003560] disabled:opacity-50"
              >
                {cohortStatusSaving ? "Updating..." : statusActionLabel}
              </Button>
              {cohortStatusError ? (
                <p className="text-xs text-red-500">{cohortStatusError}</p>
              ) : null}
            </div>
          ) : null}

          <Separator />

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-[#534F4F]">Question Set</p>
            <QuestionSetRow onViewEdit={handleOpenQuestionSet} />
          </div>

          <Separator />

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-[#534F4F]">Reviewers</p>
            <ReviewersRow reviewersEnabled={overview?.reviewersEnabled ?? false} />
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-[#534F4F]">Custom Questions</p>
              {!questionsLocked && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleOpenAddCustomQuestion}
                  className="h-7 border-[#00ABEB] px-2 text-xs text-[#004070]"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add Custom Question
                </Button>
              )}
            </div>
            <div className="rounded-md border">
              <ol className="divide-y">
                {customQuestionsLoading ? (
                  <li className="px-3 py-2.5 text-xs text-muted-foreground">Loading custom questions...</li>
                ) : customQuestions.length === 0 ? (
                  <li className="px-3 py-2.5 text-xs text-muted-foreground">No custom questions for this cohort.</li>
                ) : (
                  customQuestions.map((q, i) => (
                    <li key={q.id} className="flex items-start gap-3 px-3 py-2.5 text-xs">
                      <span className="shrink-0 text-[#534F4F]">{i + 1}.</span>
                      <div className="flex-1 space-y-0.5">
                        <p className="font-medium text-[#004070]">{q.text}</p>
                        {q.description ? (
                          <p className="text-muted-foreground">{q.description}</p>
                        ) : null}
                        <p className="text-muted-foreground">
                          Possible answers: {q.answerOptions.length
                            ? q.answerOptions.map((option) => `${option.responseText} (${option.pointValue})`).join(", ")
                            : "—"}
                        </p>
                      </div>
                      <button
                        onClick={() => handleOpenEditCustomQuestion(q)}
                        className="shrink-0 text-[#00ABEB] hover:underline"
                      >
                        Edit
                      </button>
                    </li>
                  ))
                )}
              </ol>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-xs font-medium text-[#534F4F]">Removed Questions</p>
            <div className="rounded-md border">
              {removedQuestionsLoading ? (
                <p className="px-3 py-2.5 text-xs text-muted-foreground">Loading removed questions...</p>
              ) : removedQuestions.length === 0 ? (
                <p className="px-3 py-2.5 text-xs text-muted-foreground">No removed questions.</p>
              ) : (
                <ol className="divide-y">
                  {removedQuestions.map((q, i) => (
                    <li key={q.id} className="flex items-start gap-3 px-3 py-2.5">
                      <span className="shrink-0 text-xs text-[#534F4F]">{i + 1}.</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-[#004070]">{q.name}</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void handleRestoreQuestion(q.id)}
                        disabled={questionRestoringId === q.id}
                        className="h-7 border-[#00ABEB] px-2 text-xs text-[#004070]"
                      >
                        {questionRestoringId === q.id ? "Restoring..." : "Restore"}
                      </Button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Expanded dialog ── */}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[90vh] w-[90vw] !max-w-[90vw] overflow-y-auto"
        >
          {/* Header */}
          <div className="relative flex items-center justify-center pb-2">
            <DialogTitle className="text-lg font-semibold text-[#004070]">
              Assessment Templates
            </DialogTitle>
            <DialogClose asChild>
              <button className="absolute right-0 text-muted-foreground hover:text-[#004070]">
                <Minimize2 className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>

          <ExpandedContent
            template={selectedCohortId}
            onTemplateChange={onCohortChange}
            options={templateOptions}
            overview={overview}
            overviewLoading={overviewLoading}
            onOpenQuestionSet={handleOpenQuestionSet}
            customQuestions={customQuestions}
            customQuestionsLoading={customQuestionsLoading}
            onOpenAddCustomQuestion={handleOpenAddCustomQuestion}
            onEditCustomQuestion={handleOpenEditCustomQuestion}
            removedQuestions={removedQuestions}
            removedQuestionsLoading={removedQuestionsLoading}
            onRestoreQuestion={(templateSkillId) => void handleRestoreQuestion(templateSkillId)}
            restoringQuestionId={questionRestoringId}
            statusActionLabel={statusActionLabel}
            onStatusAction={() =>
              void updateCohortStatus(currentStatus === "Draft" ? "Active" : "Completed")
            }
            statusActionLoading={cohortStatusSaving}
            statusActionError={cohortStatusError}
            cohortStatus={currentStatus}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmEndOpen} onOpenChange={setConfirmEndOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle className="text-lg font-semibold text-[#004070]">
            End Cohort Test?
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {uncompletedInvitees > 0
              ? `${uncompletedInvitees} invitee(s) still have uncompleted assessments.`
              : "This will end the cohort test."}
          </DialogDescription>
          <div className="space-y-3">
            <p className="text-sm text-[#004070]">
              Ending this cohort will block additional assessment starts.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmEndOpen(false)}
                className="border-[#004070] text-[#004070]"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void updateCohortStatus("Completed", true)}
                disabled={cohortStatusSaving}
                className="bg-[#004070] text-white hover:bg-[#003560] disabled:opacity-50"
              >
                {cohortStatusSaving ? "Ending..." : "End Test"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={questionSetOpen} onOpenChange={setQuestionSetOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogTitle className="text-lg font-semibold text-[#004070]">
            Question Set
          </DialogTitle>

          <div className="space-y-4">
            <div className="rounded-md border bg-[#F8FAFC] px-4 py-3 text-sm text-[#004070]">
              <div className="font-medium">
                {questionSet?.templateTitle ?? "CCMI Self Assessment"}
              </div>
              {!questionSetLoading && !questionSetError ? (
                <div className="mt-1 text-xs text-muted-foreground">
                  {(questionSet?.questions.length ?? 0)} questions
                </div>
              ) : null}
            </div>

            {questionSetLoading ? (
              <p className="text-sm text-muted-foreground">Loading questions...</p>
            ) : questionSetError ? (
              <p className="text-sm text-red-600">{questionSetError}</p>
            ) : groupedQuestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No questions found for this template.</p>
            ) : (
              <div className="space-y-4">
                {groupedQuestions.map((group) => (
                  <div key={group.groupName} className="rounded-md border">
                    <div className="border-b bg-gray-50 px-4 py-2 text-xs font-semibold text-[#004070]">
                      {group.groupName}
                    </div>
                    <ol className="divide-y">
                      {group.items.map((q, index) => (
                        <li key={q.id} className="px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-sm font-medium text-[#004070]">
                              {index + 1}. {q.name}
                            </div>
                            {!questionsLocked && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => void handleRemoveExistingQuestion(q.id)}
                                disabled={questionRemovingId === q.id}
                                className="h-7 px-2 text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="mr-1 h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                          {q.description ? (
                            <p className="mt-1 text-xs text-muted-foreground">{q.description}</p>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}
            {questionActionError ? (
              <p className="text-sm text-red-600">{questionActionError}</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editCustomQuestionModalOpen}
        onOpenChange={(open) => {
          setEditCustomQuestionModalOpen(open);
          if (!open) resetEditCustomQuestionDraft();
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogTitle className="text-lg font-semibold text-[#004070]">
            Edit Custom Question
          </DialogTitle>

          <form onSubmit={handleUpdateCustomQuestion} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#534F4F]">Name</label>
              <textarea
                required
                rows={2}
                value={editingCustomQuestion.name}
                onChange={(e) =>
                  setEditingCustomQuestion((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-[#004070] outline-none focus:ring-2 focus:ring-[#00ABEB]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#534F4F]">Question Text</label>
              <textarea
                required
                rows={3}
                value={editingCustomQuestion.questionText}
                onChange={(e) =>
                  setEditingCustomQuestion((prev) => ({
                    ...prev,
                    questionText: e.target.value,
                  }))
                }
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-[#004070] outline-none focus:ring-2 focus:ring-[#00ABEB]"
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-[#534F4F]">Possible Answers</p>
              <div className="space-y-2">
                {editingCustomQuestion.answerOptions.map((option, idx) => (
                  <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_140px]">
                    <Input
                      value={option.responseText}
                      onChange={(e) =>
                        setEditingCustomQuestion((prev) => ({
                          ...prev,
                          answerOptions: prev.answerOptions.map((row, rowIndex) =>
                            rowIndex === idx ? { ...row, responseText: e.target.value } : row
                          ),
                        }))
                      }
                      placeholder={`Answer option ${idx + 1}`}
                      className="h-9"
                    />
                    <Input
                      type="number"
                      value={option.pointValue}
                      onChange={(e) =>
                        setEditingCustomQuestion((prev) => ({
                          ...prev,
                          answerOptions: prev.answerOptions.map((row, rowIndex) =>
                            rowIndex === idx ? { ...row, pointValue: e.target.value } : row
                          ),
                        }))
                      }
                      placeholder="Points"
                      className="h-9"
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setEditingCustomQuestion((prev) => ({
                      ...prev,
                      answerOptions: [...prev.answerOptions, { responseText: "", pointValue: "0" }],
                    }))
                  }
                  className="h-8 border-[#00ABEB] px-2 text-xs text-[#004070]"
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Add Answer
                </Button>
              </div>
            </div>

            {editCustomQuestionError ? (
              <p className="text-xs text-red-600">{editCustomQuestionError}</p>
            ) : null}

            <div className="flex justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleDeleteCustomQuestion}
                disabled={customQuestionDeleting || customQuestionSaving || !editCustomQuestionId}
                className="border-red-300 text-red-600 hover:bg-red-50"
              >
                {customQuestionDeleting ? "Removing..." : "Remove Question"}
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditCustomQuestionModalOpen(false);
                    resetEditCustomQuestionDraft();
                  }}
                  className="border-[#004070] text-[#004070]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={customQuestionSaving || customQuestionDeleting}
                  className="bg-[#004070] text-white hover:bg-[#003560]"
                >
                  {customQuestionSaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={customQuestionModalOpen}
        onOpenChange={(open) => {
          setCustomQuestionModalOpen(open);
          if (!open) resetCustomQuestionDraft();
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogTitle className="text-lg font-semibold text-[#004070]">
            Add Custom Question
          </DialogTitle>

          <form onSubmit={handleCreateCustomQuestion} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#534F4F]">Name</label>
              <textarea
                required
                rows={2}
                value={newCustomQuestion.name}
                onChange={(e) =>
                  setNewCustomQuestion((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-[#004070] outline-none focus:ring-2 focus:ring-[#00ABEB]"
                placeholder="Technology Use and Understanding"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#534F4F]">Question Text</label>
              <textarea
                required
                rows={3}
                value={newCustomQuestion.questionText}
                onChange={(e) =>
                  setNewCustomQuestion((prev) => ({ ...prev, questionText: e.target.value }))
                }
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-[#004070] outline-none focus:ring-2 focus:ring-[#00ABEB]"
                placeholder="Ability to adopt, learn and apply digital tools to improve personal and team efficiency and business results."
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-[#534F4F]">Possible Answers</p>
              <div className="space-y-2">
                {newCustomQuestion.answerOptions.map((option, idx) => (
                  <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_140px]">
                    <Input
                      value={option.responseText}
                      onChange={(e) =>
                        setNewCustomQuestion((prev) => ({
                          ...prev,
                          answerOptions: prev.answerOptions.map((row, rowIndex) =>
                            rowIndex === idx ? { ...row, responseText: e.target.value } : row
                          ),
                        }))
                      }
                      placeholder={`Answer option ${idx + 1}`}
                      className="h-9"
                    />
                    <Input
                      type="number"
                      value={option.pointValue}
                      onChange={(e) =>
                        setNewCustomQuestion((prev) => ({
                          ...prev,
                          answerOptions: prev.answerOptions.map((row, rowIndex) =>
                            rowIndex === idx ? { ...row, pointValue: e.target.value } : row
                          ),
                        }))
                      }
                      placeholder="Points"
                      className="h-9"
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setNewCustomQuestion((prev) => ({
                      ...prev,
                      answerOptions: [...prev.answerOptions, { responseText: "", pointValue: "0" }],
                    }))
                  }
                  className="h-8 border-[#00ABEB] px-2 text-xs text-[#004070]"
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Add Answer
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              `name` will map to `custom_skills.name`; question text will map to the description in `meta_json`.
            </p>
            {customQuestionError ? (
              <p className="text-xs text-red-600">{customQuestionError}</p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCustomQuestionModalOpen(false);
                  resetCustomQuestionDraft();
                }}
                className="border-[#004070] text-[#004070]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={customQuestionSaving}
                className="bg-[#004070] text-white hover:bg-[#003560]"
              >
                {customQuestionSaving ? "Creating..." : "Create Question"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
