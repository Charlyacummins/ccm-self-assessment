import { getCorpTemplateOptions } from "@/lib/get-corp-template-options";
import { PendingInvitationsContent } from "@/components/corp-admin/pending-invitations-content";

export default async function PendingInvitationsPage() {
  const templateOptions = await getCorpTemplateOptions();
  return <PendingInvitationsContent templateOptions={templateOptions} />;
}
