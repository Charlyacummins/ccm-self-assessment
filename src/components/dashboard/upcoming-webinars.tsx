import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const webinars = [
  {
    title: "Ask the Expert 09/25",
    description: "Some information about the event here",
  },
  {
    title: "Ask the Expert 09/25",
    description: "Some information about the event here",
  },
  {
    title: "What are the key considerations when implementing a comprehensive enterprise-level authentication system?",
    description: "Details about this webinar will be available soon.",
  },
];

export function UpcomingWebinars() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Webinars & New Learning Materials</CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple">
          {webinars.map((webinar, i) => (
            <AccordionItem key={i} value={`webinar-${i}`}>
              <AccordionTrigger className="text-left">
                {webinar.title}
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground">
                  {webinar.description}
                </p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
