"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { QuestionCard } from "./question-card";

interface Option {
  id: string;
  response_text: string;
  point_value: number;
  display_order: number;
}

interface Question {
  id: string;
  name: string;
  description: string;
  skill_group_id: string;
  display_order: number;
  options: Option[];
}

interface SkillGroup {
  id: string;
  name: string;
}

interface Answer {
  points: number | null;
  text: string;
}

interface AssessmentFlowProps {
  assessmentId: string;
  skillGroups: SkillGroup[];
  questions: Question[];
  savedAnswers: Record<string, Answer>;
}

export function AssessmentFlow({
  assessmentId,
  skillGroups,
  questions,
  savedAnswers,
}: AssessmentFlowProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>(savedAnswers);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  // Build ordered groups from question order (first appearance of each group)
  const orderedGroupIds: string[] = [];
  for (const q of questions) {
    if (!orderedGroupIds.includes(q.skill_group_id)) {
      orderedGroupIds.push(q.skill_group_id);
    }
  }
  const groupedQuestions = orderedGroupIds
    .map((gid) => {
      const group = skillGroups.find((g) => g.id === gid);
      if (!group) return null;
      return {
        ...group,
        questions: questions.filter((q) => q.skill_group_id === gid),
      };
    })
    .filter(Boolean) as { id: string; name: string; questions: Question[] }[];

  // Reorder questions so all questions in a group are together
  const orderedQuestions = groupedQuestions.flatMap((g) => g.questions);

  const currentQuestion = orderedQuestions[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === orderedQuestions.length - 1;

  // Which group does the current question belong to?
  const currentGroupIndex = groupedQuestions.findIndex((g) =>
    g.questions.some((q) => q.id === currentQuestion?.id)
  );

  // Answer-based progress: each bar fills as questions in that group get answered
  const getGroupProgress = (groupIndex: number) => {
    const group = groupedQuestions[groupIndex];
    if (!group || group.questions.length === 0) return 0;
    const answered = group.questions.filter((q) => answers[q.id]?.points != null).length;
    return answered / group.questions.length;
  };

  // Find the selected option ID by matching points to point_value
  const getSelectedOptionId = (question: Question, answer: Answer | undefined) => {
    if (!answer || answer.points == null) return "";
    const match = question.options.find((o) => o.point_value === answer.points);
    return match?.id ?? "";
  };

  const saveAnswer = useCallback(
    async (questionId: string, answer: Answer) => {
      if (answer.points == null && !answer.text) return;

      setSaving(true);
      try {
        await fetch("/api/assessment/save-answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assessmentId,
            templateSkillId: questionId,
            points: answer.points,
            openEndedResponse: answer.text,
          }),
        });
      } catch (err) {
        console.error("Failed to save answer:", err);
      } finally {
        setSaving(false);
      }
    },
    [assessmentId]
  );

  const debouncedSave = useCallback(
    (questionId: string, answer: Answer) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => saveAnswer(questionId, answer), 500);
    },
    [saveAnswer]
  );

  const handleSelectOption = (optionId: string) => {
    const option = currentQuestion.options.find((o) => o.id === optionId);
    if (!option) return;

    const updated: Answer = {
      points: option.point_value,
      text: answers[currentQuestion.id]?.text ?? "",
    };
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: updated }));
    saveAnswer(currentQuestion.id, updated);
  };

  const handleChangeText = (text: string) => {
    const updated: Answer = {
      points: answers[currentQuestion.id]?.points ?? null,
      text,
    };
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: updated }));
    debouncedSave(currentQuestion.id, updated);
  };

  const goNext = () => {
    if (!isLast) setCurrentIndex((i) => i + 1);
  };

  const goPrev = () => {
    if (!isFirst) setCurrentIndex((i) => i - 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await fetch("/api/assessment/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId }),
      });
      router.push("/results");
    } catch (err) {
      console.error("Failed to submit assessment:", err);
      setSubmitting(false);
    }
  };

  if (!currentQuestion) return null;

  const currentAnswer = answers[currentQuestion.id] ?? {
    points: null,
    text: "",
  };

  return (
    <div className="space-y-6">
      {/* Progress bars with group labels */}
      <div className="flex gap-1.5">
        {groupedQuestions.map((group, i) => (
          <div key={group.id} className="flex-1 space-y-1">
            <p className={`truncate text-[10px] font-medium ${
              i === currentGroupIndex ? "text-[#004070]" : "text-gray-400"
            }`}>
              {group.name}
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-[#004070] transition-all duration-300"
                style={{
                  width: `${getGroupProgress(i) * 100}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={goPrev}
          disabled={isFirst}
          className="flex items-center gap-1 text-sm font-medium text-[#004070] disabled:opacity-30"
        >
          <span>&#8249;</span> Previous
        </button>

        <span className="text-xs text-gray-400">
          {saving ? "Saving..." : ""}
        </span>

        {isLast ? (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-1 text-sm font-medium text-[#004070] disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit"} <span>&#8250;</span>
          </button>
        ) : (
          <button
            onClick={goNext}
            className="flex items-center gap-1 text-sm font-medium text-[#004070]"
          >
            Next <span>&#8250;</span>
          </button>
        )}
      </div>

      {/* Question card */}
      <QuestionCard
        questionName={currentQuestion.name}
        questionDescription={currentQuestion.description}
        questionNumber={currentIndex + 1}
        options={currentQuestion.options}
        selectedOptionId={getSelectedOptionId(currentQuestion, currentAnswer)}
        responseText={currentAnswer.text}
        onSelectOption={handleSelectOption}
        onChangeText={handleChangeText}
      />
    </div>
  );
}
