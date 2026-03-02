import { getCorpTemplateOptions } from "@/lib/get-corp-template-options";
import { ReviewersContent } from "@/components/corp-admin/reviewers-content";

export default async function ReviewersPage() {
  const templateOptions = await getCorpTemplateOptions();
  return <ReviewersContent templateOptions={templateOptions} />;
}
