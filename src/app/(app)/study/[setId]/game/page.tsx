import { StudyPage } from "../study-page";

export default function Page({ params }: PageProps<"/study/[setId]/game">) {
  return <StudyPage params={params} mode="game" />;
}
