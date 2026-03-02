import { getCorpTemplateOptions } from "@/lib/get-corp-template-options";
import { UsersContent } from "@/components/corp-admin/users-content";

export default async function UsersPage() {
  const templateOptions = await getCorpTemplateOptions();
  return <UsersContent templateOptions={templateOptions} />;
}
