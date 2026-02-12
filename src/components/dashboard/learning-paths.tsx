import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const currentPaths = [
  "Example Learning Path one",
  "Example Learning Path one",
];

const recommendedPaths = [
  "Example Learning Path one",
  "Example Learning Path one",
];

export function LearningPaths() {
  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        <div>
          <h3 className="mb-3 text-lg font-semibold text-[#004070]">
            Current Learning Paths
          </h3>
          <Accordion type="multiple">
            {currentPaths.map((path, i) => (
              <AccordionItem key={`current-${i}`} value={`current-${i}`}>
                <AccordionTrigger>{path}</AccordionTrigger>
                <AccordionContent>
                  Learning path details and progress will go here.
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <div>
          <h3 className="mb-3 text-lg font-semibold text-[#004070]">
            Recommended Learning Paths
          </h3>
          <Accordion type="multiple">
            {recommendedPaths.map((path, i) => (
              <AccordionItem key={`rec-${i}`} value={`rec-${i}`}>
                <AccordionTrigger>{path}</AccordionTrigger>
                <AccordionContent>
                  Learning path details and enrollment options will go here.
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </CardContent>
    </Card>
  );
}
