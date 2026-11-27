import { StudyPage } from "../study-page";

export default function Page({ params }: PageProps<"/study/[setId]/dictation">) {
  return <StudyPage params={params} mode="dictation" />;
}
