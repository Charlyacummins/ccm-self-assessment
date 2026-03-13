import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SupportContactForm } from "@/components/corp-admin/support-contact-form";
import { BookOpen, ExternalLink, LifeBuoy } from "lucide-react";

const FAQS = [
  {
    q: "How do I access submissions assigned to me?",
    a: "Go to the Submissions page. All participants assigned to you for review will appear there. Click a participant's name to open their self-assessment and enter your evaluation scores.",
  },
  {
    q: "Can I change my review scores after saving?",
    a: "Yes — you can update your scores at any time until the cohort administrator closes the review period. Navigate back to the participant's submission and edit as needed.",
  },
  {
    q: "What happens if I don't complete a review?",
    a: "Any skill groups you haven't scored will fall back to the participant's self-assessment score on their results page. Only the scores you submit will override the participant's own responses.",
  },
  {
    q: "Do participants see my individual scores?",
    a: "Participants see their results page which includes reviewer scores where present. Whether individual reviewer identities are visible depends on cohort settings configured by the administrator.",
  },
  {
    q: "How do I update my name or email?",
    a: "Your name can be updated from the Account page. Email address changes are managed through your sign-in method (e.g. Google or email/password settings).",
  },
];

const QUICK_LINKS = [
  {
    label: "CCM Institute Website",
    href: "https://ccm.institute/",
    description: "Main CCM Institute website and resources",
  },
];

export default async function ReviewerSupportPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const [user, supabase] = await Promise.all([
    currentUser(),
    Promise.resolve(db()),
  ]);

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  const fullName = profile?.full_name ?? user?.fullName ?? "";
  const email =
    user?.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#004070]">Support</h1>
        <p className="mt-1 text-sm text-[#534F4F]">
          Get help with your reviews or account.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {/* Contact form */}
          <SupportContactForm
            fullName={fullName}
            email={email}
            endpoint="/api/support"
          />

          {/* FAQ */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#004070]">
                <LifeBuoy className="h-5 w-5" />
                Frequently Asked Questions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {FAQS.map((faq, i) => (
                  <AccordionItem key={i} value={`faq-${i}`}>
                    <AccordionTrigger className="text-[#004070]">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-[#534F4F]">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick links */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#004070]">
                <BookOpen className="h-5 w-5" />
                Resources
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {QUICK_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start justify-between gap-2 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-gray-50"
                >
                  <span>
                    <span className="font-medium text-[#004070]">
                      {link.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-[#534F4F]">
                      {link.description}
                    </span>
                  </span>
                  <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#534F4F]" />
                </a>
              ))}
            </CardContent>
          </Card>

          {/* Direct contact */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-[#004070]">
                Direct Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[#534F4F]">
              <div>
                <p className="font-medium text-[#004070]">Response time</p>
                <p>Within 1 business day</p>
              </div>
              <div>
                <p className="font-medium text-[#004070]">Support hours</p>
                <p>Mon–Fri, 9am–5pm ET</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
