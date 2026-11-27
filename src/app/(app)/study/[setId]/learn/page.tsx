import { StudyPage } from "../study-page";

export default function Page({ params }: PageProps<"/study/[setId]/learn">) {
  return <StudyPage params={params} mode="learn" />;
}
