import { router } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "@/components/app-icon";
import { nothing } from "@/components/nothing-ui";
import { NativeScreen } from "@/components/screen";

type LegalPage = "privacy" | "terms" | "dmca" | "licenses";

const sections: { key: LegalPage; label: string; detail: string; icon: string }[] = [
  { key: "privacy", label: "Privacy Policy", detail: "Bagaimana kami mengumpulkan, menggunakan, dan melindungi data kamu.", icon: "account-circle-outline" },
  { key: "terms", label: "Terms of Service", detail: "Ketentuan akun, penggunaan, dan kebijakan yang berlaku.", icon: "cog-outline" },
  { key: "dmca", label: "DMCA / Hak Cipta", detail: "Pemberitahuan hak cipta dan prosedur counter-notice.", icon: "content-copy" },
  { key: "licenses", label: "Open Source Licenses", detail: "Perangkat lunak pihak ketiga dan lisensinya.", icon: "open-in-new" },
];

function PrivacyPolicy() {
  return (
    <View style={styles.legalContent}>
      <Text style={styles.legalHeading}>Privacy Policy</Text>
      <Text style={styles.legalDate}>Berlaku sejak: Oktober 2026</Text>
      <Text style={styles.legalBody}>{`Nuenime ("kami") mengoperasikan aplikasi streaming dan penemuan anime Nuenime. Kebijakan ini menjelaskan apa yang digunakan, mengapa, dan di mana datamu tersimpan.\n\n1. INFORMASI YANG KAMI KUMPULKAN\n\n• Akun: alamat email dan status verifikasi untuk masuk dan pemulihan.\n• Sesi: token terenkripsi di keychain/keystore perangkat, dihapus saat keluar.\n• Perpustakaan: progres tontonan, bookmark, rating, komentar, notifikasi, dan profil, disinkronkan ke akunmu.\n• Hanya di perangkat: preferensi NSFW dengan afirmasi 18+ sekali pakai, riwayat pencarian, dan opsi notifikasi — tidak pernah dikirim ke server.\n• Metadata: judul anime dan data provider dari AniList dan Nuenime API; hanya cache sementara.\n• Kami tidak mengumpulkan identifier iklan atau analitik perilaku.\n\n2. CARA KAMI MENGGUNAKANNYA\n\n• Untuk menyediakan penemuan konten, koordinasi pemutaran, dan sinkronisasi antar perangkat.\n• Untuk menampilkan status pemulihan yang dapat dipahami saat terjadi kesalahan.\n• Kami tidak menjual data pribadi.\n\n3. KEAMANAN\n\n• Lalu lintas data dienkripsi saat transit (TLS).\n• Token provider tetap di sisi server dan tidak pernah masuk ke aplikasi.\n• Catatan akun dibatasi untuk pengguna yang masuk.\n\n4. HAK KAMU\n\n• Hapus riwayat tontonan dan bookmark di Pengaturan.\n• Hapus akunmu di Pengaturan — menghapus catatanmu terlebih dahulu, kemudian login itu sendiri. Tidak dapat dibatalkan.\n• Minta salinan datamu: privacy@nuenime.app\n\n5. ANAK-ANAK DAN KONTEN DEWASA\n\n• Tidak untuk anak-anak di bawah 13 tahun.\n• Judul dewasa tetap tersembunyi sampai kamu menegaskan berusia 18 tahun atau lebih.\n\n6. PERUBAHAN\n\nPerubahan material akan dikomunikasikan melalui pemberitahuan dalam aplikasi.\n\n7. KONTAK\n\nprivacy@nuenime.app`}</Text>
    </View>
  );
}

function TermsOfService() {
  return (
    <View style={styles.legalContent}>
      <Text style={styles.legalHeading}>Terms of Service</Text>
      <Text style={styles.legalDate}>Berlaku sejak: Oktober 2026</Text>
      <Text style={styles.legalBody}>{`Dengan menggunakan Nuenime, kamu menyetujui ketentuan ini.\n\n1. LAYANAN\n\nNuenime adalah antarmuka penemuan dan koordinasi pemutaran anime gratis. Kami tidak meng-host video dan tidak memberikan hak atas konten pihak ketiga. Kualitas, subtitle, jadwal, dan ketersediaan berasal dari pihak ketiga dan dapat berubah sewaktu-waktu.\n\n2. KELAYAKAN\n\nKamu harus berusia minimal 13 tahun. Judul dewasa memerlukan afirmasi eksplisit berusia 18 tahun atau lebih dan harus sesuai hukum di wilayahmu.\n\n3. AKUN\n\nEmail terverifikasi diperlukan untuk fitur terproteksi. Kamu bertanggung jawab atas kredensial dan aktivitas akunmu. Jangan bypass autentikasi, mengumpulkan data, mengganggu layanan, atau menyalahgunakan penghapusan dan pelaporan.\n\n4. PENGGUNAAN YANG DAPAT DITERIMA\n\nKamu setuju untuk tidak:\n• Menggunakan aplikasi untuk tujuan ilegal.\n• Memposting konten melanggar hukum, kasar, melanggar hak cipta, spam, atau menipu.\n• Mengganggu atau mengeksploitasi layanan.\n• Mendistribusikan ulang atau menjual kembali konten yang diakses melalui aplikasi.\n\n5. KEKAYAAN INTELEKTUAL\n\nAplikasi Nuenime dirilis di bawah Lisensi MIT. Konten anime adalah milik pemiliknya masing-masing. Masalah hak cipta mengikuti bagian DMCA / Hak Cipta.\n\n6. PENGHENTIAN\n\nKamu dapat berhenti menggunakan aplikasi atau menghapus akunmu (Pengaturan) kapan saja. Kami dapat membatasi atau menghentikan akses untuk pelanggaran, termasuk pelanggaran hak cipta berulang.\n\n7. PENAFIAN DAN TANGGUNG JAWAB\n\nDisediakan "sebagaimana adanya" dan "sebagaimana tersedia" tanpa jaminan. Sejauh yang diizinkan hukum, kami tidak bertanggung jawab atas kerugian tidak langsung atau konsekuensial.\n\n8. PERUBAHAN\n\nPerubahan material akan dikomunikasikan melalui pemberitahuan dalam aplikasi. Penggunaan berkelanjutan dianggap sebagai penerimaan.\n\n9. KONTAK\n\nlegal@nuenime.app`}</Text>
    </View>
  );
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
