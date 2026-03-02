"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Copy } from "lucide-react";

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00ABEB] ${
        checked ? "bg-[#004070]" : "bg-gray-200"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export function InvitesCard() {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [linkEnabled, setLinkEnabled] = useState(false);
  const [customLink, setCustomLink] = useState("");

  const toggleEmail = () => {
    if (!emailEnabled) {
      setEmailEnabled(true);
      setLinkEnabled(false);
    } else {
      setEmailEnabled(false);
    }
  };

  const toggleLink = () => {
    if (!linkEnabled) {
      setLinkEnabled(true);
      setEmailEnabled(false);
    } else {
      setLinkEnabled(false);
    }
  };

  const handleCopy = () => {
    if (customLink) {
      navigator.clipboard.writeText(customLink);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-center text-base text-[#004070]">Invites</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-xs text-muted-foreground">
          How would you like to invite employees to the assessment?
        </p>

        {/* 1. Email Invitation */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#004070]">1. Email Invitation</p>
          <div className="flex items-center gap-3">
            <Toggle checked={emailEnabled} onChange={toggleEmail} />
            <button className="flex items-center gap-1 text-xs text-[#004070] hover:text-[#00ABEB]">
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          </div>
        </div>

        {/* 2. Custom Link */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#004070]">2. Custom Link</p>
          <div className="flex items-center gap-2">
            <Toggle checked={linkEnabled} onChange={toggleLink} />
            <div className="relative flex-1">
              <Input
                placeholder="Examplelink..."
                value={customLink}
                onChange={(e) => setCustomLink(e.target.value)}
                className="h-8 pr-8 text-xs"
              />
              <button
                onClick={handleCopy}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-[#004070]"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Save */}
        <Button
          variant="outline"
          className="w-full border-[#00ABEB] text-[#004070] hover:bg-[#004070] hover:text-white"
        >
          Save
        </Button>
      </CardContent>
    </Card>
  );
}
