"use client";

import { useState } from "react";
import { AssessmentTemplatesPanel } from "./assessment-templates-panel";
import { ManageUsersTable } from "./manage-users-table";
import { AssessmentSettingsCard } from "./assessment-settings-card";
import { InvitesCard } from "./invites-card";
import { CORP_ADMIN_SELECTED_COHORT_COOKIE } from "@/lib/corp-admin-selected-cohort-cookie";

export interface TemplateOption {
  value: string;
  label: string;
  corporationId: string;
}

export function ManageAssessmentsContent({
  templateOptions = [],
  initialSelectedCohortId,
}: {
  templateOptions?: TemplateOption[];
  initialSelectedCohortId?: string | null;
}) {
  const initialCohortId =
    initialSelectedCohortId && templateOptions.some((option) => option.value === initialSelectedCohortId)
      ? initialSelectedCohortId
      : (templateOptions[0]?.value ?? "");

  const [selectedCohortId, setSelectedCohortId] = useState(
    initialCohortId
  );

  const handleCohortChange = (cohortId: string) => {
    setSelectedCohortId(cohortId);
    if (!cohortId) {
      document.cookie = `${CORP_ADMIN_SELECTED_COHORT_COOKIE}=; path=/; max-age=0; samesite=lax`;
      return;
    }
    document.cookie = `${CORP_ADMIN_SELECTED_COHORT_COOKIE}=${encodeURIComponent(cohortId)}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <div
      className="grid gap-6 lg:grid-cols-[1fr_2fr]"
      style={{ height: "calc(100vh - 200px)" }}
    >
      {/* Left column: fills height, card scrolls */}
      <div className="min-w-0 overflow-hidden flex flex-col">
        <AssessmentTemplatesPanel
          templateOptions={templateOptions}
          selectedCohortId={selectedCohortId}
          onCohortChange={handleCohortChange}
        />
      </div>

      {/* Right column: Manage Users grows to fill, Settings/Invites pinned at bottom */}
      <div className="flex min-h-0 flex-col gap-6">
        <div className="min-h-0 flex-1">
          <ManageUsersTable cohortId={selectedCohortId} />
        </div>
        <div className="grid flex-shrink-0 gap-6 lg:grid-cols-2">
          <AssessmentSettingsCard cohortId={selectedCohortId} />
          <InvitesCard />
        </div>
      </div>
    </div>
  );
}
