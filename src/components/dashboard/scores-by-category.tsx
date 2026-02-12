import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";

interface SkillGroup {
  id: string;
  name: string;
  score: number;
}

export function ScoresByCategory({
  skillGroups,
  hasResults,
}: {
  skillGroups: SkillGroup[];
  hasResults: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scores by Category</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasResults ? (
          <p className="text-sm text-muted-foreground">
            Complete your first assessment to see scores by category.
          </p>
        ) : (
          <Table>
            <TableBody>
              {skillGroups.map((sg) => (
                <TableRow key={sg.id}>
                  <TableCell className="text-sm text-[#004070]">
                    {sg.name}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline">{sg.score}%</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
