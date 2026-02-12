"use client";

import { Card, CardContent } from "@/components/ui/card";

interface Option {
  id: string;
  response_text: string;
  point_value: number;
  display_order: number;
}

interface QuestionCardProps {
  questionName: string;
  questionDescription: string;
  questionNumber: number;
  options: Option[];
  selectedOptionId: string;
  responseText: string;
  onSelectOption: (optionId: string) => void;
  onChangeText: (text: string) => void;
}

export function QuestionCard({
  questionName,
  questionDescription,
  questionNumber,
  options,
  selectedOptionId,
  responseText,
  onSelectOption,
  onChangeText,
}: QuestionCardProps) {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardContent className="px-10 py-10">
        <h2 className="text-center text-lg font-semibold text-[#004070]">
          {questionName}
        </h2>
        <p className="mt-1 text-center text-sm text-gray-500">
          Question {questionNumber}
        </p>
        {questionDescription && (
          <p className="mt-2 text-center text-sm text-gray-600">
            {questionDescription}
          </p>
        )}

        <div className="mt-8 space-y-3">
          {options.map((option) => (
            <label
              key={option.id}
              className={`flex cursor-pointer items-center gap-3 rounded-full border px-5 py-3 transition-colors ${
                selectedOptionId === option.id
                  ? "border-[#00ABEB] bg-[#00ABEB]/5"
                  : "border-gray-200 bg-gray-50 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="question-option"
                value={option.id}
                checked={selectedOptionId === option.id}
                onChange={() => onSelectOption(option.id)}
                className="h-4 w-4 accent-[#00ABEB]"
              />
              <span className="text-sm text-[#004070]">
                {option.response_text}
              </span>
            </label>
          ))}
        </div>

        <div className="mt-8">
          <p className="mb-2 text-sm text-gray-500">
            Describe this experience
          </p>
          <textarea
            value={responseText}
            onChange={(e) => onChangeText(e.target.value)}
            placeholder="Type your message here."
            rows={3}
            className="w-full resize-y rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-[#004070] placeholder:text-gray-400 focus:border-[#00ABEB] focus:outline-none focus:ring-1 focus:ring-[#00ABEB]"
          />
        </div>
      </CardContent>
    </Card>
  );
}
