import React, { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppIcon } from "@/components/app-icon";
import { hapticLight } from "@/lib/haptics";
import {
  getLatestGlobalMessage,
  subscribeGlobalMessages,
} from "@/lib/global-chat-service";

const HOME_DISCUSSION_CACHE_KEY = "@nuenime_latest_discussion_msg";

export function HomePublicDiscussionBar() {
  const [latestSnippet, setLatestSnippet] = useState<{
    senderName: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;

    // 1. Ambil cache offline secara instan untuk rendering cepat tanpa delay
    AsyncStorage.getItem(HOME_DISCUSSION_CACHE_KEY).then((raw) => {
      if (raw && isMounted) {
        try {
          const parsed = JSON.parse(raw);
          if (
            parsed &&
            parsed.senderName &&
            parsed.message &&
            !String(parsed.senderName).includes("Kyosukee") &&
            !String(parsed.senderName).includes("AGIL")
          ) {
            setLatestSnippet(parsed);
          }
        } catch {}
      }
    });

    // 2. Ambil data pesan terbaru dari backend Supabase
    getLatestGlobalMessage().then((msg) => {
      if (msg && isMounted) {
        setLatestSnippet(msg);
        AsyncStorage.setItem(HOME_DISCUSSION_CACHE_KEY, JSON.stringify(msg)).catch(() => {});
      }
    });

    // 3. Berlangganan Realtime Supabase untuk cuplikan pesan hidup (live update)
    const unsubscribe = subscribeGlobalMessages("ngobrol_1", (newMsg) => {
      if (!isMounted) return;
      const snippet = {
        senderName: newMsg.senderName,
        message: newMsg.message,
      };
      setLatestSnippet(snippet);
      AsyncStorage.setItem(HOME_DISCUSSION_CACHE_KEY, JSON.stringify(snippet)).catch(() => {});
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const handlePress = () => {
    hapticLight();
    router.push("/chat-global" as never);
  };

  const sender = latestSnippet?.senderName || "Komunitas";
  const text = latestSnippet?.message || "Belum ada pesan. Mulai obrolan sekarang!";

  return (
    <View style={styles.outerWrapper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Public Diskusi Chat Global Nuenime"
        onPress={handlePress}
        // @ts-ignore
        onClick={handlePress}
        style={({ pressed }) => [
          styles.container,
          pressed && styles.pressed,
          Platform.OS === "web" && ({ cursor: "pointer" } as any),
        ]}
      >
        {/* Sisi Kiri: Ikon Chat Bubble & Label "Public Diskusi" */}
        <View style={styles.leftCol}>
          <AppIcon name="chat" size={17} color="#38BDF8" />
          <Text style={styles.titleText}>Public Diskusi</Text>
        </View>

        {/* Garis Pemisah Vertikal Tipis */}
        <View style={styles.divider} />

        {/* Bagian Tengah: Nama Pengirim (Emas/Kuning) & Cuplikan Pesan */}
        <View style={styles.messageCol}>
          <Text style={styles.senderText} numberOfLines={1}>
            {sender}
          </Text>
          <Text style={styles.colonText}> : </Text>
          <Text style={styles.snippetText} numberOfLines={1} ellipsizeMode="tail">
            {text}
          </Text>
        </View>

        {/* Sisi Kanan: Ikon Panah Emas penanda interaktif */}
        <View style={styles.arrowWrap}>
          <AppIcon name="arrow-right" size={15} color="#FBBF24" />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrapper: {
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
  },
  container: {
    height: 44,
    borderRadius: 14,
    backgroundColor: "#151821",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  leftCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flexShrink: 0,
  },
  titleText: {
    fontFamily: "Nunito-Bold",
    fontSize: 13,
    color: "#FFFFFF",
    letterSpacing: -0.1,
  },
  divider: {
    width: 1,
    height: 14,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    marginHorizontal: 10,
    flexShrink: 0,
  },
  messageCol: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    marginRight: 6,
  },
  senderText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#FBBF24",
    flexShrink: 0,
    maxWidth: 90,
  },
  colonText: {
    fontFamily: "Nunito-Bold",
    fontSize: 12.5,
    color: "#94A3B8",
    flexShrink: 0,
  },
  snippetText: {
    flex: 1,
    fontFamily: "Nunito-Regular",
    fontSize: 12.5,
    color: "#CBD5E1",
  },
  arrowWrap: {
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
