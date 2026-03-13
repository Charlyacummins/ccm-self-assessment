"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";

const SUBJECTS = [
  "Technical Issue",
  "Billing & Payment",
  "Cohort Setup Help",
  "Results & Reporting",
  "User Management",
  "Other",
];

export function SupportContactForm({
  fullName,
  email,
  endpoint = "/api/corp-admin/support",
}: {
  fullName: string;
  email: string;
  endpoint?: string;
}) {
  const [form, setForm] = useState({
    name: fullName,
    email,
    subject: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const update = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#004070]">
          <MessageSquare className="h-5 w-5" />
          Contact Support
        </CardTitle>
        <p className="text-sm text-[#534F4F]">
          Send us a message and we&apos;ll get back to you within one business day.
        </p>
      </CardHeader>
      <CardContent>
        {status === "sent" ? (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-6 text-center">
            <p className="font-medium text-green-800">Message sent!</p>
            <p className="mt-1 text-sm text-green-700">
              We&apos;ll follow up at {form.email} shortly.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setStatus("idle")}
            >
              Send another message
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#004070]">Name</label>
                <Input
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#004070]">Email</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#004070]">Subject</label>
              <select
                value={form.subject}
                onChange={(e) => update("subject", e.target.value)}
                required
                className="border-input h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="" disabled>
                  Select a subject…
                </option>
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#004070]">Message</label>
              <textarea
                value={form.message}
                onChange={(e) => update("message", e.target.value)}
                required
                rows={5}
                placeholder="Describe your issue or question in detail…"
                className="border-input w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
              />
            </div>

            {status === "error" && (
              <p className="text-sm text-red-600">
                Something went wrong. Please try again.
              </p>
            )}

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={status === "sending"}
                className="bg-[#004070] text-white hover:bg-[#004070]/90"
              >
                {status === "sending" ? "Sending…" : "Send Message"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
