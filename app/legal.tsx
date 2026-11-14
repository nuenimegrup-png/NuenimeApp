import { router } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "@/components/app-icon";
import { nothing } from "@/components/nothing-ui";
import { NativeScreen } from "@/components/screen";
import {
  TERMS_OF_SERVICE,
  PRIVACY_POLICY,
  LegalDocument,
} from "@/constants/legal-content";

type LegalPage = "privacy" | "terms" | "dmca" | "licenses";

const sections: { key: LegalPage; label: string; detail: string; icon: string }[] = [
  { key: "privacy", label: "Privacy Policy", detail: "Bagaimana kami mengumpulkan, menggunakan, dan melindungi data kamu.", icon: "account-circle-outline" },
  { key: "terms", label: "Terms of Service", detail: "Ketentuan akun, penggunaan, dan kebijakan yang berlaku.", icon: "cog-outline" },
  { key: "dmca", label: "DMCA / Hak Cipta", detail: "Pemberitahuan hak cipta dan prosedur counter-notice.", icon: "content-copy" },
  { key: "licenses", label: "Open Source Licenses", detail: "Perangkat lunak pihak ketiga dan lisensinya.", icon: "open-in-new" },
];

function DocumentRenderer({ doc }: { doc: LegalDocument }) {
  return (
    <View style={styles.legalContent}>
      <Text style={styles.legalHeading}>{doc.title}</Text>
      <Text style={styles.legalDate}>Terakhir diperbarui: {doc.lastUpdated}</Text>
      <View style={styles.summaryBox}>
        <Text style={styles.summaryText}>{doc.summary}</Text>
      </View>
      {doc.sections.map((sec, idx) => (
        <View key={sec.title + idx} style={{ marginTop: 14 }}>
          <Text style={styles.sectionSubtitle}>
            {idx + 1}. {sec.title.toUpperCase()}
          </Text>
          <Text style={styles.legalBody}>{sec.content}</Text>
        </View>
      ))}
      <View style={styles.contactFooterBox}>
        <Text style={styles.contactFooterText}>
          Kontak Layanan: {doc.contactEmail}
        </Text>
      </View>
    </View>
  );
}

function PrivacyPolicy() {
  return <DocumentRenderer doc={PRIVACY_POLICY} />;
}

function TermsOfService() {
  return <DocumentRenderer doc={TERMS_OF_SERVICE} />;
}

function DMCAPolicy() {
  return (
    <View style={styles.legalContent}>
      <Text style={styles.legalHeading}>DMCA / Kebijakan Hak Cipta</Text>
      <Text style={styles.legalDate}>Berlaku sejak: Oktober 2026</Text>
      <Text style={styles.legalBody}>{`Nuenime menghormati hak kekayaan intelektual. Nuenime tidak meng-host file video; di mana pemberitahuan yang valid mengidentifikasi materi yang dapat dijangkau, akses dihapus atau dinonaktifkan dengan segera.\n\n1. AGEN YANG DITUNJUK\n\nKirim pemberitahuan dan counter-notice ke:\n\ndmca@nuenime.app\n\nGunakan "DMCA Notice" atau "DMCA Counter-Notice" di baris subjek.\n\n2. PEMBERITAHUAN TAKEDOWN\n\nPemberitahuan yang valid harus mencakup:\n• Tanda tangan kamu (fisik atau elektronik).\n• Identifikasi karya berhak cipta.\n• Lokasi tepat dalam aplikasi (rute, judul, episode, provider).\n• Nama, alamat, telepon, dan email kamu.\n• Pernyataan niat baik.\n• Pernyataan akurasi di bawah sumpah dengan otoritas bertindak.\n\nPemberitahuan yang tidak lengkap akan dikembalikan dengan penjelasan.\n\n3. COUNTER-NOTICES\n\nJika materimu dihapus karena kesalahan, kirim tanda tangan, apa yang dihapus dan di mana ia muncul, pernyataan kesalahan dengan niat baik, detail kontak kamu, dan persetujuan yurisdiksi pengadilan. Akses dapat dipulihkan dalam 10–14 hari kerja.\n\n4. PELANGGAR BERULANG\n\nAkun pelanggar berulang dihentikan.\n\n5. KESALAHAN REPRESENTASI\n\nKlaim palsu dapat menimbulkan tanggung jawab atas kerusakan, biaya, dan biaya pengacara.\n\n6. KONTAK\n\ndmca@nuenime.app`}</Text>
    </View>
  );
}

function OSSLicenses() {
  const licenses = [
    { name: "react-native", license: "MIT License", copyright: "Copyright (c) Meta Platforms, Inc." },
    { name: "expo", license: "MIT License", copyright: "Copyright (c) 650 Industries" },
    { name: "react-native-video", license: "MIT License", copyright: "Copyright (c) Airbnb" },
    { name: "react-native-webview", license: "MIT License", copyright: "Copyright (c) Facebook Inc." },
    { name: "@tanstack/react-query", license: "MIT License", copyright: "Copyright (c) Tanner Linsley" },
    { name: "expo-image", license: "MIT License", copyright: "Copyright (c) 650 Industries" },
    { name: "expo-router", license: "MIT License", copyright: "Copyright (c) 650 Industries" },
    { name: "expo-haptics", license: "MIT License", copyright: "Copyright (c) 650 Industries" },
    { name: "expo-secure-store", license: "MIT License", copyright: "Copyright (c) 650 Industries" },
    { name: "expo-web-browser", license: "MIT License", copyright: "Copyright (c) 650 Industries" },
    { name: "expo-notifications", license: "MIT License", copyright: "Copyright (c) 650 Industries" },
    { name: "expo-linear-gradient", license: "MIT License", copyright: "Copyright (c) 650 Industries" },
    { name: "@react-native-async-storage/async-storage", license: "MIT License", copyright: "Copyright (c) React Native Community" },
    { name: "react-native-gesture-handler", license: "MIT License", copyright: "Copyright (c) Software Mansion" },
    { name: "react-native-safe-area-context", license: "MIT License", copyright: "Copyright (c) Th3rdwave" },
  ];

  return (
    <View style={styles.legalContent}>
      <Text style={styles.legalHeading}>Open Source Licenses</Text>
      <Text style={styles.legalDate}>Nuenime dibangun dengan perangkat lunak open source.</Text>
      {licenses.map((lib) => (
        <View key={lib.name} style={styles.licenseRow}>
          <Text style={styles.licenseName}>{lib.name}</Text>
          <Text style={styles.licenseType}>{lib.license}</Text>
          <Text style={styles.licenseCopyright}>{lib.copyright}</Text>
        </View>
      ))}
      <View style={styles.mitBox}>
        <Text style={styles.legalBody}>{`Nuenime sendiri dirilis di bawah Lisensi MIT.\n\nCopyright (c) 2026 Team Nuenime\n\nIzin diberikan secara gratis kepada siapa pun yang mendapatkan salinan perangkat lunak ini untuk menggunakannya tanpa batasan, termasuk tanpa batasan hak untuk menggunakan, menyalin, memodifikasi, menggabungkan, menerbitkan, mendistribusikan, mensublisensikan, dan/atau menjual salinannya.\n\nPERANGKAT LUNAK INI DISEDIAKAN "SEBAGAIMANA ADANYA", TANPA JAMINAN APA PUN.`}</Text>
      </View>
    </View>
  );
}

const contentMap = {
  privacy: PrivacyPolicy,
  terms: TermsOfService,
  dmca: DMCAPolicy,
  licenses: OSSLicenses,
};

export default function LegalScreen() {
  const [activePage, setActivePage] = useState<LegalPage | null>(null);

  if (activePage) {
    const Content = contentMap[activePage];
    return (
      <NativeScreen scroll={false}>
        {/* Back header */}
        <View style={styles.subHeader}>
          <Pressable
            onPress={() => setActivePage(null)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          >
            <AppIcon name="arrow-left" size={19} color={nothing.white} />
          </Pressable>
          <Text style={styles.subHeaderTitle}>Legal</Text>
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollInner}
          showsVerticalScrollIndicator={false}
        >
          <Content />
        </ScrollView>
      </NativeScreen>
    );
  }

  return (
    <NativeScreen scroll={false}>
      {/* Sticky Header */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <AppIcon name="arrow-left" size={21} color={nothing.white} />
        </Pressable>
        <View style={{ gap: 1 }}>
          <Text style={styles.headerEyebrow}>NUENIME · HUKUM</Text>
          <Text style={styles.headerTitle}>Legal</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Section cards */}
        {sections.map((section) => (
          <Pressable
            key={section.key}
            onPress={() => setActivePage(section.key)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.sectionCard, pressed && { opacity: 0.7 }]}
          >
            <View style={styles.sectionIconWrap}>
              <AppIcon name={section.icon} size={18} color="#E2E8F0" />
            </View>
            <View style={styles.sectionBody}>
              <Text style={styles.sectionTitle}>{section.label}</Text>
              <Text style={styles.sectionDetail}>{section.detail}</Text>
            </View>
            <AppIcon name="chevron-right" size={18} color="#94A3B8" />
          </Pressable>
        ))}

        {/* Contact card */}
        <View style={styles.contactCard}>
          <View style={styles.contactHeader}>
            <AppIcon name="earth" size={15} color="#E2E8F0" />
            <Text style={styles.contactTitle}>Kontak</Text>
          </View>
          {[
            { label: "Privacy", value: "privacy@nuenime.app" },
            { label: "Copyright / DMCA", value: "dmca@nuenime.app" },
            { label: "Legal", value: "legal@nuenime.app" },
          ].map((c) => (
            <View key={c.label} style={styles.contactRow}>
              <Text style={styles.contactLabel}>{c.label}</Text>
              <Text style={styles.contactValue}>{c.value}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footerNote}>
          © 2026 Team Nuenime. Semua hak dilindungi undang-undang.
        </Text>
      </ScrollView>
    </NativeScreen>
  );
}

const styles = StyleSheet.create({
  // ── Headers ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 14,
    backgroundColor: "#0B0E17",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  subHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 14,
    backgroundColor: "#0B0E17",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  subHeaderTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 16,
    color: "#64748B",
    letterSpacing: 0.3,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    ...(Platform.OS === "web"
      ? ({
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      } as any)
      : {}),
  },
  headerEyebrow: {
    fontFamily: "Nunito-Bold",
    fontSize: 10,
    color: "#94A3B8",
    letterSpacing: 1,
  },
  headerTitle: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 20,
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 52,
    gap: 12,
  },
  scrollInner: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 52,
  },

  // ── Section Cards (Liquid Glass & Silver) ──
  sectionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    padding: 16,
    ...(Platform.OS === "web"
      ? ({
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      } as any)
      : {}),
  },
  sectionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web"
      ? ({
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      } as any)
      : {}),
  },
  sectionBody: { flex: 1, gap: 3 },
  sectionTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 15,
    color: "#FFFFFF",
  },
  sectionDetail: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#94A3B8",
    lineHeight: 17,
  },

  // ── Contact Card (Liquid Glass & Silver) ──
  contactCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    padding: 18,
    gap: 12,
    marginTop: 6,
    ...(Platform.OS === "web"
      ? ({
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      } as any)
      : {}),
  },
  contactHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  contactTitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#E2E8F0",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  contactRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  contactLabel: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 12,
    color: "#94A3B8",
  },
  contactValue: {
    fontFamily: "Nunito-Regular",
    fontSize: 12,
    color: "#CBD5E1",
  },

  footerNote: {
    fontFamily: "Nunito-Regular",
    fontSize: 11.5,
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
  },

  // ── Legal Content (inner pages) ──
  legalContent: { gap: 14 },
  legalHeading: {
    fontFamily: "Nunito-ExtraBold",
    fontSize: 22,
    color: "#FFFFFF",
    letterSpacing: -0.4,
  },
  legalDate: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
    letterSpacing: 0.3,
    marginTop: -6,
  },
  legalBody: {
    fontFamily: "Nunito-Regular",
    fontSize: 13,
    color: "#CBD5E1",
    lineHeight: 21,
  },
  sectionSubtitle: {
    fontFamily: "Nunito-Bold",
    fontSize: 14,
    color: "#F8FAFC",
    marginBottom: 6,
  },
  summaryBox: {
    backgroundColor: "rgba(56, 189, 248, 0.08)",
    borderLeftWidth: 3,
    borderLeftColor: "#38BDF8",
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  summaryText: {
    fontFamily: "Nunito-Medium",
    fontSize: 12.5,
    lineHeight: 18,
    color: "#E2E8F0",
  },
  contactFooterBox: {
    marginTop: 24,
    padding: 12,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  contactFooterText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#38BDF8",
    textAlign: "center",
  },
  licenseRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    gap: 3,
  },
  licenseName: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  licenseType: {
    fontFamily: "Nunito-SemiBold",
    fontSize: 10.5,
    color: "#CBD5E1",
  },
  licenseCopyright: {
    fontFamily: "Nunito-Regular",
    fontSize: 11,
    color: "#94A3B8",
  },
  mitBox: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    padding: 16,
    marginTop: 10,
    ...(Platform.OS === "web"
      ? ({
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      } as any)
      : {}),
  },
});
