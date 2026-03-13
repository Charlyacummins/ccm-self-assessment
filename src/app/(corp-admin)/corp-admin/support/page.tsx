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
    q: "How do I change my cohort's status from Draft to Active?",
    a: "Go to Manage Assessments, select your cohort, and use the status dropdown in the cohort header. Moving to Active will send invitation emails to all roster members and lock the question set.",
  },
  {
    q: "Can users retake the assessment after submitting?",
    a: "No — once an assessment is submitted it is locked. If a user needs to retake, please contact support and we can reset their submission.",
  },
  {
    q: "How are cohort scores calculated?",
    a: "Each skill group score is the average of all submitted user scores for that group, expressed as a percentage of the maximum possible points. Reviewer scores override self-assessment scores where present.",
  },
  {
    q: "What does individual result visibility control?",
    a: "When enabled in cohort settings, the Results page allows you to filter down to a single user's scores alongside the cohort average. Useful for one-on-one coaching conversations.",
  },
  {
    q: "How do I add users to my cohort roster?",
    a: "Navigate to Rosters → Users, then use the Invite Users button. You can invite by email address individually or upload a CSV. Invited users will appear in Pending Invitations until they accept.",
  },
  {
    q: "What is the global benchmark?",
    a: "The global benchmark shows aggregated scores from all assessments across the CCMI platform for the same skill groups. It gives you a market-wide comparison point for your cohort's performance.",
  },
  {
    q: "How do groups work within a cohort?",
    a: "Groups are sub-divisions of your cohort roster (e.g. by department or region). When grouping is enabled, you can filter the Results page to view aggregate scores for a specific group.",
  },
];

const QUICK_LINKS = [
  {
    label: "CCM Institute Website",
    href: "https://ccm.institute/",
    description: "Main CCM Institute website and resources",
  },
];

export default async function CorpAdminSupportPage() {
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
          Get help with your cohort, results, or account.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {/* Contact form */}
          <SupportContactForm fullName={fullName} email={email} />

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
