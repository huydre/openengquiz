import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { cardDefinition, type StudyCard } from "./study-types";

Font.register({
  family: "Be Vietnam Pro",
  fonts: [
    { src: path.join(process.cwd(), "public/fonts/BeVietnamPro-Regular.ttf"), fontWeight: 400 },
    { src: path.join(process.cwd(), "public/fonts/BeVietnamPro-Bold.ttf"), fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: "Be Vietnam Pro", fontSize: 10, color: "#243124" },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 5 },
  subtitle: { fontSize: 10, color: "#647364", marginBottom: 18 },
  heading: { fontSize: 13, fontWeight: 700, marginTop: 14, marginBottom: 8 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#b7c5b7", paddingVertical: 6 },
  number: { width: 24, color: "#647364" },
  term: { width: "35%", fontWeight: 700 },
  definition: { flex: 1 },
  writingRow: { marginBottom: 14 },
  line: { borderBottomWidth: 0.7, borderBottomColor: "#9eaf9e", height: 19 },
  question: { marginBottom: 9, lineHeight: 1.8 },
});

export function WorksheetDocument({ title, cards }: { title: string; cards: StudyCard[] }) {
  return (
    <Document title={`Phiếu học từ vựng: ${title}`} author="OpenEngQuiz">
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>Phiếu học từ vựng | Họ tên: ____________________  Ngày: __________</Text>
        <Text style={styles.heading}>1. Bảng từ</Text>
        {cards.map((card, index) => (
          <View key={card.id} style={styles.tableRow} wrap={false}>
            <Text style={styles.number}>{index + 1}.</Text>
            <Text style={styles.term}>{card.term}</Text>
            <Text style={styles.definition}>{cardDefinition(card)}</Text>
          </View>
        ))}
        <Text style={styles.heading} break>2. Luyện viết</Text>
        {cards.map((card, index) => (
          <View key={card.id} style={styles.writingRow} wrap={false}>
            <Text>{index + 1}. {cardDefinition(card)}</Text>
            <View style={styles.line} />
            <View style={styles.line} />
          </View>
        ))}
        <Text style={styles.heading} break>3. Điền từ tiếng Anh</Text>
        {cards.map((card, index) => (
          <Text key={card.id} style={styles.question}>
            {index + 1}. {cardDefinition(card)}: ______________________________
          </Text>
        ))}
      </Page>
    </Document>
  );
}
