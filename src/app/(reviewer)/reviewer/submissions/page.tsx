import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const submissions = [
  {
    id: "asm_1001",
    name: "Acme Corp",
    assessment: "Contract Management Maturity",
    submittedDate: "2026-02-01",
    status: "Pending",
  },
  {
    id: "asm_1002",
    name: "Northwind Logistics",
    assessment: "Procurement Capability Baseline",
    submittedDate: "2026-01-28",
    status: "In Review",
  },
  {
    id: "asm_1003",
    name: "Globex Industries",
    assessment: "Supplier Governance Assessment",
    submittedDate: "2026-01-25",
    status: "Pending",
  },
];

export default function ReviewerSubmissionsPage() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-[#004070]">Submissions</h1>
        <p className="mt-2 text-sm text-[#534F4F]">
          Assigned assessments awaiting reviewer action.
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Assessment</TableHead>
            <TableHead>Submitted Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((submission) => (
            <TableRow key={submission.id}>
              <TableCell className="font-medium text-[#004070]">{submission.name}</TableCell>
              <TableCell>{submission.assessment}</TableCell>
              <TableCell>{submission.submittedDate}</TableCell>
              <TableCell>{submission.status}</TableCell>
              <TableCell>
                <Link
                  href={`/reviewer/submissions/${submission.id}`}
                  className="font-medium text-[#00ABEB] hover:text-[#004070]"
                >
                  Review
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
