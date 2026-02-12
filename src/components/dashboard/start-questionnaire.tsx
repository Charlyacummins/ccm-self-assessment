import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function StartQuestionnaire() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Start Questionnaire</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Some info about the Questionnaire and learning paths here
        </p>
        <ul className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
          <li>Complete your self-assessment</li>
          <li>Review your results</li>
          <li>Get personalized learning paths</li>
          <li>Track your progress</li>
        </ul>
        <Button asChild className="w-full bg-[#004070] hover:bg-[#004070]/90">
          <Link href="/assessment">Start</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
