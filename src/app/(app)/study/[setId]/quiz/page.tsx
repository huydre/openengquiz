import { StudyPage } from "../study-page";

export default function Page({ params }: PageProps<"/study/[setId]/quiz">) {
  return <StudyPage params={params} mode="quiz" />;
}
