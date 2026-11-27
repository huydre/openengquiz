import { StudyPage } from "../study-page";

export default function Page({ params }: PageProps<"/study/[setId]/writing">) {
  return <StudyPage params={params} mode="writing" />;
}
