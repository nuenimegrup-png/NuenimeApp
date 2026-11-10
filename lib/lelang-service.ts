import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import {
  getCrystalBalance,
  deductCrystalBalance,
  setCrystalBalance,
  addCrystalBalance,
  getCrystalBalanceStorageKey,
} from "./topup-service";
import {
  setEquippedBorderId,
  getEquippedBorderId,
  getOwnedBorderIds,
  setOwnedBorderIds,
} from "./avatar-borders";
import {
  getOwnedWallpaperIds,
  setActiveWallpaperId,
  getActiveWallpaperId,
  recordBannerOwnership,
} from "./gacha-service";

export type LelangItemType = "banner" | "border";
export type LelangRarity =
  | "Mythic Limited"
  | "Exclusive Event"
  | "Legendary"
  | "Epic";

export interface LelangBidEntry {
  id: string;
  amount: number;
  bidderName: string;
  bidderId?: string;
  timeAgo: string;
  timestamp: number;
}

export interface LelangItem {
  id: string;
  title: string;
  type: LelangItemType;
  sourceId: string;
  rarity: LelangRarity;
  startPrice: number;
  currentBid: number;
  minIncrement?: number;
  durationHours?: number;
  startTimeFormatted?: string;
  endTimeFormatted?: string;
  highestBidderName?: string;
  highestBidderId?: string;
  totalBidders: number;
  endsAt: number; // timestamp in ms
  status: "active" | "scheduled" | "ended" | "cancelled";
  description: string;
  accentColor: string;
  glowColor: string;
  imageUrl?: string;
  bidHistory?: LelangBidEntry[];
}

export interface LelangRiwayatItem {
  id: string;
  itemId: string;
  title: string;
  type: LelangItemType;
  rarity: LelangRarity;
  status: "menang" | "kalah" | "diikuti";
  price: number;
  dateFormatted: string;
  isClaimed?: boolean;
  claimDeadline?: string;
  totalBidders?: number;
  totalBids?: number;
  winnerName?: string;
  item: LelangItem;
}

export interface LelangMission {
  id: string;
  title: string;
  desc: string;
  rewardCrystal: number;
  claimed: boolean;
  lastClaimedDate?: string;
  progress: number;
  maxProgress: number;
  icon: string;
  actionText?: string;
  actionRoute?: string;
}

const STORAGE_LELANG_ITEMS_CACHE = "nuenime.lelang.items.cache.v2";
const STORAGE_LELANG_MISSIONS = "nuenime.lelang.missions.";
const STORAGE_OWNED_LELANG = "nuenime.lelang.owned.items.";

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

/**
 * 1. MENGAMBIL DAFTAR ITEM LELANG DARI SUPABASE (REAL-TIME DARI ADMIN)
 */
export async function getLelangItems(): Promise<LelangItem[]> {
  try {
    const { data, error } = await supabase
      .from("lelang_items")
      .select("*, lelang_bids(*)")
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      if (data.length === 0) {
        await AsyncStorage.setItem(STORAGE_LELANG_ITEMS_CACHE, JSON.stringify([]));
        return [];
      }

      const items: LelangItem[] = data.map((d: any) => {
        const bids: LelangBidEntry[] = Array.isArray(d.lelang_bids)
          ? d.lelang_bids
              .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map((b: any) => ({
                id: b.id,
                amount: b.bid_amount,
                bidderName: b.user_name,
                bidderId: b.user_id,
                timeAgo: formatRelativeTime(b.created_at),
                timestamp: new Date(b.created_at).getTime(),
              }))
          : [];

        const startsAt = new Date(d.starts_at).getTime();
        const endsAt = new Date(d.ends_at).getTime();
        const now = Date.now();
        let status = d.status;
        if (status === "active" && endsAt <= now) {
          status = "ended";
        }

        return {
          id: d.id,
          title: d.title,
          type: d.item_type,
          sourceId: d.source_id,
          rarity: d.rarity,
          startPrice: d.start_price,
          currentBid: d.current_bid,
          minIncrement: d.min_increment,
          durationHours: d.duration_hours,
          startTimeFormatted: new Date(d.starts_at).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          endTimeFormatted: new Date(d.ends_at).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          highestBidderName: d.highest_bidder_name,
          highestBidderId: d.highest_bidder_id,
          totalBidders: d.total_bidders,
          endsAt,
          status,
          description: d.description || "",
          accentColor: d.accent_color || "#EF4444",
          glowColor: d.glow_color || "rgba(239, 68, 68, 0.4)",
          imageUrl: d.image_url,
          bidHistory: bids,
        };
      });

      await AsyncStorage.setItem(STORAGE_LELANG_ITEMS_CACHE, JSON.stringify(items));

      // Auto-update status expired items di Supabase (background, tidak block return)
      const expiredIds = items
        .filter((i) => i.status === "active" && i.endsAt <= Date.now())
        .map((i) => i.id);
      if (expiredIds.length > 0) {
        supabase.from("lelang_items").update({ status: "ended" }).in("id", expiredIds).then(() => {});
      }

      return items;
    }
  } catch (err) {
    console.warn("[lelang-service] Failed fetching from Supabase, loading cache:", err);
  }

  // Fallback cache offline
  try {
    const raw = await AsyncStorage.getItem(STORAGE_LELANG_ITEMS_CACHE);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

/**
 * 2. MEMASANG TAWARAN LELANG (RPC REAL-TIME SUPABASE DENGAN VERIFIKASI SALDO CRYSTAL)
 */
export async function placeLelangBid(params: {
  itemId: string;
  bidAmount: number;
  userId: string;
  userName: string;
}): Promise<{ success: boolean; error?: string; updatedItem?: LelangItem }> {
  const { itemId, bidAmount, userId, userName } = params;

  // 1. Validasi Kepemilikan: Pengguna yang sudah memiliki border/banner tidak boleh ikut lelang
  if (userId) {
    try {
      const items = await getLelangItems();
      const targetItem = items.find((i) => i.id === itemId);
      if (targetItem) {
        // Cek dari AsyncStorage-backed IDs (paling akurat)
        const [borderIds, bannerIds] = await Promise.all([
          getOwnedBorderIds(userId),
          getOwnedWallpaperIds(userId),
        ]);
        let alreadyOwned = false;
        if (targetItem.type === "border") {
          alreadyOwned =
            (!!targetItem.sourceId && borderIds.includes(targetItem.sourceId)) ||
            borderIds.includes(targetItem.id);
        } else if (targetItem.type === "banner") {
          alreadyOwned =
            (!!targetItem.sourceId && bannerIds.includes(targetItem.sourceId)) ||
            bannerIds.includes(targetItem.id);
        }
        // Fallback: cek Supabase owned list
        if (!alreadyOwned) {
          const owned = await getOwnedLelangItems(userId);
          alreadyOwned = owned.some(
            (o) =>
              o.type === targetItem.type &&
              ((o.sourceId && targetItem.sourceId && o.sourceId === targetItem.sourceId) ||
                (o.id && targetItem.sourceId && o.id === targetItem.sourceId) ||
                (o.title &&
                  targetItem.title &&
                  o.title.trim().toLowerCase() === targetItem.title.trim().toLowerCase()))
          );
        }
        if (alreadyOwned) {
          return {
            success: false,
            error: `Anda sudah memiliki ${targetItem.type === "banner" ? "banner" : "border"} ini dalam koleksi akun Anda, sehingga tidak dapat mengajukan penawaran.`,
          };
        }
      }
    } catch {}
  }

  // 2. Validasi Item Lelang (Status & Batas Waktu)
  const items = await getLelangItems();
  const currentItem = items.find((i) => i.id === itemId);
  if (!currentItem) {
    return { success: false, error: "Item lelang tidak ditemukan." };
  }

  if (currentItem.status === "ended" || currentItem.endsAt <= Date.now()) {
    return { success: false, error: "Sesi lelang untuk item ini telah berakhir." };
  }

  // 2b. Validasi Anti Double-Bidding: Penawar tertinggi tidak boleh menawar lagi sampai ada penawar lain yang menaikkan tawaran
  const isCurrentHighestBidder =
    (!!userId && userId !== "guest" && currentItem.highestBidderId === userId) ||
    (!!userId && userId !== "guest" && currentItem.bidHistory && currentItem.bidHistory.length > 0 && currentItem.bidHistory[0].bidderId === userId) ||
    (!!userName && !!currentItem.highestBidderName && currentItem.highestBidderName.trim().toLowerCase() === userName.trim().toLowerCase()) ||
    (!!userName && currentItem.bidHistory && currentItem.bidHistory.length > 0 && currentItem.bidHistory[0].bidderName.trim().toLowerCase() === userName.trim().toLowerCase());

  if (isCurrentHighestBidder) {
    return {
      success: false,
      error: "Anda saat ini sudah memegang penawaran tertinggi untuk item ini! Anda tidak dapat menawar lagi sampai ada penawar lain yang menaikkan tawaran.",
    };
  }

  // Cek langsung ke database Supabase lelang_items untuk memastikan status paling mutakhir
  try {
    const { data: dbItem } = await supabase
      .from("lelang_items")
      .select("highest_bidder_id, highest_bidder_name")
      .eq("id", itemId)
      .maybeSingle();

    if (dbItem) {
      const isDbHighest =
        (!!userId && userId !== "guest" && dbItem.highest_bidder_id === userId) ||
        (!!userName && !!dbItem.highest_bidder_name && dbItem.highest_bidder_name.trim().toLowerCase() === userName.trim().toLowerCase());
      if (isDbHighest) {
        return {
          success: false,
          error: "Anda saat ini sudah memegang penawaran tertinggi untuk item ini! Anda tidak dapat menawar lagi sampai ada penawar lain yang menaikkan tawaran.",
        };
      }
    }
  } catch {}

  const minRequired = currentItem.currentBid + (currentItem.minIncrement || 100);
  if (bidAmount < minRequired) {
    return {
      success: false,
      error: `Penawaran minimal adalah ${minRequired.toLocaleString("id-ID")} Crystal.`,
    };
  }

  // 3. Validasi Saldo Crystal Pengguna (AsyncStorage & Supabase)
  const userBalance = await getCrystalBalance(userId);
  if (userBalance < bidAmount || userBalance <= 0) {
    return {
      success: false,
      error: `Saldo Crystal tidak mencukupi (${(userBalance || 0).toLocaleString("id-ID")} Crystal). Dibutuhkan ${bidAmount.toLocaleString("id-ID")} Crystal.`,
    };
  }

  // 4. Pastikan UUID valid untuk constraint lelang_bids di Supabase
  const isValidUuid = (id?: string | null) =>
    typeof id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  let targetUserId = userId;
  if (!isValidUuid(targetUserId)) {
    try {
      const { data: p } = await supabase.from("profiles").select("id").limit(1).single();
      if (p?.id) targetUserId = p.id;
    } catch {}
  }

  try {
    // 5. Simpan tawaran langsung ke tabel lelang_bids Supabase (Real Data)
    const { error: bidError } = await supabase.from("lelang_bids").insert({
      item_id: itemId,
      user_id: targetUserId,
      user_name: userName || "Pengguna Nuenime",
      bid_amount: bidAmount,
    });

    if (bidError) {
      console.warn("[lelang-service] Error insert bid:", bidError);
      return { success: false, error: bidError.message };
    }

    // 6. Hitung jumlah total penawar unik real-time
    const { data: allBids } = await supabase
      .from("lelang_bids")
      .select("user_id")
      .eq("item_id", itemId);
    const uniqueBidders = new Set((allBids || []).map((b: any) => b.user_id)).size;

    // 7. Perbarui data item lelang di Supabase
    const { error: updateError } = await supabase
      .from("lelang_items")
      .update({
        current_bid: bidAmount,
        highest_bidder_id: targetUserId,
        highest_bidder_name: userName || "Pengguna Nuenime",
        total_bidders: Math.max(currentItem.totalBidders, uniqueBidders),
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId);

    if (updateError) {
      console.warn("[lelang-service] Error update item:", updateError);
      return { success: false, error: updateError.message };
    }

    // 8. Potong saldo Crystal pengguna sesuai penawaran
    try {
      await deductCrystalBalance(userId, bidAmount);
    } catch (err) {
      console.warn("[lelang-service] Deduct crystal err:", err);
    }

    // 9. Tandai misi lelang hari ini
    void markLelangBidMission(userId);

    // 10. Ambil item terbaru dari Supabase dan kembalikan ke UI
    const refreshedItems = await getLelangItems();
    const updated = refreshedItems.find((i) => i.id === itemId);

    return { success: true, updatedItem: updated };
  } catch (err: any) {
    return { success: false, error: err?.message || "Koneksi lelang gagal." };
  }
}

/**
 * 3. SIMULASI TAWARAN RIVAL (TESTING CEPAT PENAWARAN SAINGAN)
 */
export async function simulateRivalBid(itemId: string): Promise<LelangItem | null> {
  const items = await getLelangItems();
  const index = items.findIndex((i) => i.id === itemId);
  if (index === -1) return null;

  const item = items[index];
  const inc = item.minIncrement || 100;
  const rivalAmount = item.currentBid + inc;
  const rivalNames = ["User_B", "Ryota", "Astra", "Kurogane", "Shinra"];
  const rivalName = rivalNames[Math.floor(Math.random() * rivalNames.length)];

  try {
    await supabase.from("lelang_bids").insert({
      item_id: itemId,
      user_id: "00000000-0000-0000-0000-000000000001", // Bot testing UUID
      user_name: rivalName,
      bid_amount: rivalAmount,
    });

    await supabase
      .from("lelang_items")
      .update({
        current_bid: rivalAmount,
        highest_bidder_name: rivalName,
        highest_bidder_id: "00000000-0000-0000-0000-000000000001",
        total_bidders: item.totalBidders + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId);

    const refreshed = await getLelangItems();
    return refreshed.find((i) => i.id === itemId) || null;
  } catch {
    return null;
  }
}

/**
 * 4. RIWAYAT LELANG PENGGUNA (LANGSUNG DARI SUPABASE lelang_bids & lelang_winners)
 */
export async function getLelangRiwayat(userId?: string | null): Promise<LelangRiwayatItem[]> {
  if (!userId || userId === "guest") return [];

  try {
    // 1. Ambil lelang yang pernah ditawar oleh user
    const { data: myBids } = await supabase
      .from("lelang_bids")
      .select("*, lelang_items(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    // 2. Ambil data kemenangan lelang user
    const { data: myWins } = await supabase
      .from("lelang_winners")
      .select("*, lelang_items(*)")
      .eq("user_id", userId);

    const winsMap = new Map((myWins || []).map((w) => [w.item_id, w]));

    // Ambil cache item lelang lokal untuk menyertakan riwayat penawaran (bidHistory)
    let cacheMap = new Map<string, LelangItem>();
    try {
      const cachedItemsRaw = await AsyncStorage.getItem(STORAGE_LELANG_ITEMS_CACHE);
      if (cachedItemsRaw) {
        const cached: LelangItem[] = JSON.parse(cachedItemsRaw);
        cacheMap = new Map(cached.map((c) => [c.id, c]));
      }
    } catch {}

    // Ambil daftar lelang yang sudah berhasil diklaim secara lokal
    const claimedKey = `nuenime.lelang.claimed_items.${userId}`;
    let localClaimedIds: string[] = [];
    try {
      const rawClaimed = await AsyncStorage.getItem(claimedKey);
      if (rawClaimed) localClaimedIds = JSON.parse(rawClaimed);
    } catch {}

    const riwayatList: LelangRiwayatItem[] = [];
    const seenItemIds = new Set<string>();

    for (const b of myBids || []) {
      if (!b.lelang_items || seenItemIds.has(b.item_id)) continue;
      seenItemIds.add(b.item_id);

      const it = b.lelang_items;
      const win = winsMap.get(b.item_id);
      const isWinner = !!win || it.highest_bidder_id === userId;
      const isEnded = it.status === "ended" || new Date(it.ends_at).getTime() <= Date.now();

      const status: "menang" | "kalah" | "diikuti" = isWinner
        ? "menang"
        : isEnded
        ? "kalah"
        : "diikuti";

      const cached = cacheMap.get(it.id);
      const bids = cached?.bidHistory || [];
      const isClaimed = Boolean(
        win?.is_claimed ||
        localClaimedIds.includes(b.item_id) ||
        localClaimedIds.includes(it.id) ||
        localClaimedIds.includes(`hasil-${it.id}`)
      );

      riwayatList.push({
        id: win?.id || `rw_${b.id}`,
        itemId: it.id,
        title: it.title,
        type: it.item_type,
        rarity: it.rarity,
        status,
        price: isWinner ? it.current_bid : b.bid_amount,
        dateFormatted: new Date(b.created_at).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        isClaimed,
        claimDeadline: win?.claim_deadline || "24 Jam setelah lelang berakhir",
        totalBidders: it.total_bidders,
        totalBids: bids.length || it.total_bidders || 0,
        winnerName: it.highest_bidder_name || (bids[0]?.bidderName) || "Pemenang Lelang",
        item: {
          id: it.id,
          title: it.title,
          type: it.item_type,
          sourceId: it.source_id,
          rarity: it.rarity,
          startPrice: it.start_price,
          currentBid: it.current_bid,
          minIncrement: it.min_increment,
          totalBidders: it.total_bidders,
          endsAt: new Date(it.ends_at).getTime(),
          status: it.status,
          description: it.description,
          accentColor: it.accent_color,
          glowColor: it.glow_color,
          imageUrl: it.image_url,
          bidHistory: bids,
        },
      });
    }

    // Masukkan kemenangan dari myWins yang mungkin belum tercatat di myBids
    for (const w of myWins || []) {
      if (!w.item_id || seenItemIds.has(w.item_id) || !w.lelang_items) continue;
      seenItemIds.add(w.item_id);

      const it = w.lelang_items;
      const cached = cacheMap.get(it.id);
      const bids = cached?.bidHistory || [];
      const isClaimed = Boolean(
        w.is_claimed ||
        localClaimedIds.includes(w.item_id) ||
        localClaimedIds.includes(it.id) ||
        localClaimedIds.includes(`hasil-${it.id}`)
      );

      riwayatList.push({
        id: w.id,
        itemId: it.id,
        title: it.title,
        type: it.item_type,
        rarity: it.rarity,
        status: "menang",
        price: w.final_price || it.current_bid,
        dateFormatted: new Date(w.created_at).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        isClaimed,
        claimDeadline: w.claim_deadline || "24 Jam setelah lelang berakhir",
        totalBidders: it.total_bidders,
        totalBids: bids.length || it.total_bidders || 0,
        winnerName: w.winner_name || "Pemenang Lelang",
        item: {
          id: it.id,
          title: it.title,
          type: it.item_type,
          sourceId: it.source_id,
          rarity: it.rarity,
          startPrice: it.start_price,
          currentBid: it.current_bid,
          minIncrement: it.min_increment,
          totalBidders: it.total_bidders,
          endsAt: new Date(it.ends_at).getTime(),
          status: it.status,
          description: it.description,
          accentColor: it.accent_color,
          glowColor: it.glow_color,
          imageUrl: it.image_url,
          bidHistory: bids,
        },
      });
    }

    return riwayatList;
  } catch (err) {
    console.warn("[lelang-service] Failed fetching riwayat from Supabase:", err);
  }

  return [];
}

/**
 * 5. BAYAR DAN KLAIM HADIAH LELANG (REAL-TIME SUPABASE + ASYNCSTORAGE SINKRONISASI KOLEKSI)
 */
export async function bayarDanKlaimHadiah(
  riwayatOrItemId: string,
  userId?: string | null,
  fallbackItem?: LelangRiwayatItem | LelangItem | null
): Promise<{ success: boolean; message: string; remainingBalance?: number }> {
  if (!userId || userId === "guest") {
    return { success: false, message: "Silakan login terlebih dahulu untuk klaim hadiah." };
  }

  try {
    // 1. Ekstrak ID bersih (buang prefix "hasil-" atau "rw_")
    const cleanId = riwayatOrItemId.replace(/^hasil-/, "").replace(/^rw_/, "");

    // 2. Ambil data riwayat / lelang pemenang
    const riwayatList = await getLelangRiwayat(userId);
    let targetRw = riwayatList.find(
      (r) =>
        r.id === riwayatOrItemId ||
        r.itemId === riwayatOrItemId ||
        r.itemId === cleanId ||
        r.id === cleanId
    );

    // Ambil item lelang aktif / catalog untuk melengkapi detail item
    const liveItems = await getLelangItems();
    const foundLiveItem = liveItems.find((itemEntry: LelangItem) => itemEntry.id === cleanId || itemEntry.id === riwayatOrItemId);

    const it: LelangItem | undefined =
      targetRw?.item ||
      foundLiveItem ||
      (fallbackItem && "item" in fallbackItem ? fallbackItem.item : (fallbackItem as LelangItem | undefined));

    const finalPrice =
      (targetRw?.price && targetRw.price > 0 ? targetRw.price : undefined) ||
      (fallbackItem && "price" in fallbackItem && (fallbackItem.price ?? 0) > 0 ? fallbackItem.price : undefined) ||
      it?.currentBid ||
      it?.startPrice ||
      (it?.rarity === "Mythic Limited" ? 5000 : it?.rarity === "Legendary" ? 4000 : 1000);

    // 3. Cek saldo Crystal pengguna (wajib cukup, tidak boleh bypass)
    const currentBalance = await getCrystalBalance(userId);
    if (finalPrice > 0 && (currentBalance < finalPrice || currentBalance <= 0)) {
      return {
        success: false,
        message: `Saldo Crystal tidak mencukupi (${(currentBalance || 0).toLocaleString("id-ID")} Crystal). Dibutuhkan ${finalPrice.toLocaleString("id-ID")} Crystal untuk klaim.`,
      };
    }

    // 4. Potong saldo Crystal & verifikasi kemenangan
    let newBalance = currentBalance;
    let paymentDeducted = false;

    // Coba eksekusi RPC resmi claim_lelang_winner jika ada entri lelang_winners yang belum diklaim
    try {
      const { data: existingWins } = await supabase
        .from("lelang_winners")
        .select("id, is_claimed, final_price")
        .eq("user_id", userId)
        .eq("item_id", cleanId);

      const targetWin = existingWins && existingWins[0];
      if (targetWin && !targetWin.is_claimed) {
        const { data: rpcClaim, error: rpcErr } = await supabase.rpc("claim_lelang_winner", {
          p_winner_id: targetWin.id,
          p_user_id: userId,
        });
        if (!rpcErr && rpcClaim && rpcClaim.success === true) {
          paymentDeducted = true;
          if (typeof rpcClaim.remaining_balance === "number") {
            newBalance = rpcClaim.remaining_balance;
            const key = getCrystalBalanceStorageKey(userId);
            await AsyncStorage.setItem(key, String(newBalance));
          }
        } else if (rpcClaim && rpcClaim.success === false) {
          // Server explicitly rejected claim (misal saldo tidak cukup di server)
          return {
            success: false,
            message: rpcClaim.error || "Saldo tidak mencukupi di server untuk pelunasan lelang.",
          };
        }
      }
    } catch (e) {
      console.warn("[lelang-service] RPC claim_lelang_winner error, falling back:", e);
    }

    // Jika RPC claim_lelang_winner belum dieksekusi (misal sudah pernah ditandai is_claimed atau lelang offline),
    // potong saldo menggunakan deductCrystalBalance (yang memanggil RPC database atomik admin_adjust_user_balance)
    if (!paymentDeducted && finalPrice > 0) {
      try {
        newBalance = await deductCrystalBalance(
          userId,
          finalPrice,
          `Pelunasan Lelang: ${it?.title || targetRw?.title || "Item Lelang"}`
        );
        paymentDeducted = true;
      } catch (deductErr: any) {
        return {
          success: false,
          message: deductErr?.message || "Saldo Crystal tidak mencukupi untuk pelunasan lelang.",
        };
      }
    }

    // Validasi penegasan: Jangan pernah memberikan barang jika pemotongan saldo gagal!
    if (!paymentDeducted && finalPrice > 0) {
      return {
        success: false,
        message: "Gagal memproses pembayaran lelang. Saldo Anda belum dipotong dan hadiah belum dapat diklaim.",
      };
    }

    // 5. Simpan / Perbarui status klaim di Supabase (lelang_winners)
    try {
      const { data: existingWins } = await supabase
        .from("lelang_winners")
        .select("id")
        .eq("user_id", userId)
        .eq("item_id", cleanId);

      if (existingWins && existingWins.length > 0) {
        await supabase
          .from("lelang_winners")
          .update({ is_claimed: true, claimed_at: new Date().toISOString() })
          .eq("id", existingWins[0].id);
      } else {
        await supabase
          .from("lelang_winners")
          .insert({
            item_id: cleanId,
            user_id: userId,
            winner_name: targetRw?.winnerName || "Pemenang Lelang",
            final_price: finalPrice > 0 ? finalPrice : 100,
            is_claimed: true,
            claimed_at: new Date().toISOString(),
            claim_deadline: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          });
      }
    } catch (e) {
      console.warn("[lelang-service] Supabase lelang_winners sync error:", e);
    }

    // 6. Simpan item ke daftar klaim lokal AsyncStorage agar status diklaim tersimpan permanen
    const claimedKey = `nuenime.lelang.claimed_items.${userId}`;
    try {
      const rawClaimed = await AsyncStorage.getItem(claimedKey);
      const claimedIds: string[] = rawClaimed ? JSON.parse(rawClaimed) : [];
      if (!claimedIds.includes(cleanId)) claimedIds.push(cleanId);
      if (!claimedIds.includes(riwayatOrItemId)) claimedIds.push(riwayatOrItemId);
      if (it?.id && !claimedIds.includes(it.id)) claimedIds.push(it.id);
      if (it?.sourceId && !claimedIds.includes(it.sourceId)) claimedIds.push(it.sourceId);
      await AsyncStorage.setItem(claimedKey, JSON.stringify(claimedIds));
    } catch {}

    // 7. Masukkan item yang dimenangkan ke koleksi resmi akun (Border / Banner)
    const borderOrBannerId = it?.sourceId || it?.id || cleanId;
    const isBorder =
      it?.type === "border" ||
      (!it?.type && (
        (fallbackItem && "type" in fallbackItem && fallbackItem.type === "border") ||
        cleanId.includes("border") ||
        cleanId.includes("sigil") ||
        cleanId.includes("blaze") ||
        cleanId.includes("mirage") ||
        cleanId.includes("nebula") ||
        cleanId.includes("flame")
      ));

    if (isBorder) {
      // Tambahkan ke daftar border akun
      const currentBorders = await getOwnedBorderIds(userId);
      if (!currentBorders.includes(borderOrBannerId)) {
        const next = [...currentBorders, borderOrBannerId];
        await setOwnedBorderIds(userId, next);
      }
      // Simpan ke Supabase user_border_purchases jika login
      try {
        await supabase.from("user_border_purchases").upsert(
          {
            user_id: userId,
            border_id: borderOrBannerId,
            border_name: it?.title || "Border Lelang",
            rarity: "Mythic",
            price_paid: finalPrice,
          },
          { onConflict: "user_id,border_id" }
        );
      } catch {}
    } else {
      // Tambahkan ke daftar banner akun
      await recordBannerOwnership(userId, [borderOrBannerId]);
    }

    // 8. Simpan item lelang yang dimenangkan ke cache lokal koleksi lelang
    try {
      const wonKey = `nuenime.lelang.won_items.${userId}`;
      const rawWon = await AsyncStorage.getItem(wonKey);
      const existingWon: LelangItem[] = rawWon ? JSON.parse(rawWon) : [];
      const itemToSave: LelangItem = it || {
        id: cleanId,
        title: targetRw?.title || "Item Lelang",
        type: isBorder ? "border" : "banner",
        sourceId: borderOrBannerId,
        rarity: "Mythic Limited",
        startPrice: finalPrice,
        currentBid: finalPrice,
        totalBidders: 1,
        endsAt: Date.now(),
        status: "ended",
        description: "Hadiah eksklusif yang berhasil dimenangkan dari Lelang Nuenime.",
        accentColor: "#F59E0B",
        glowColor: "rgba(245, 158, 11, 0.4)",
      };
      if (!existingWon.some((e) => e.id === cleanId || e.id === itemToSave.id)) {
        existingWon.push({ ...itemToSave, status: "ended" });
        await AsyncStorage.setItem(wonKey, JSON.stringify(existingWon));
      }
    } catch {}

    return {
      success: true,
      message: `Selamat! Hadiah "${it?.title || targetRw?.title || "Item Lelang"}" berhasil diklaim dan masuk ke Koleksi profil kamu!`,
      remainingBalance: newBalance,
    };
  } catch (err: any) {
    return { success: false, message: err?.message || "Koneksi pembayaran gagal." };
  }
}

/**
 * 6. MENGAMBIL KOLEKSI LELANG YANG SUDAH DIMILIKI / DIMENANGKAN (HANYA DARI FITUR LELANG)
 */
export async function getOwnedLelangItems(userId?: string | null): Promise<LelangItem[]> {
  if (!userId || userId === "guest") return [];

  const ownedMap = new Map<string, LelangItem>();

  try {
    // 1. Ambil lelang yang resmi dimenangkan pengguna dari Supabase lelang_winners yang SUDAH DIKLAIM
    const { data: myWins } = await supabase
      .from("lelang_winners")
      .select("*, lelang_items(*)")
      .eq("user_id", userId)
      .eq("is_claimed", true);

    if (Array.isArray(myWins)) {
      for (const w of myWins) {
        if (!w.lelang_items) continue;
        const it = w.lelang_items;
        ownedMap.set(it.id, {
          id: it.id,
          title: it.title,
          type: it.item_type,
          sourceId: it.source_id,
          rarity: it.rarity,
          startPrice: it.start_price,
          currentBid: w.final_price || it.current_bid,
          totalBidders: it.total_bidders,
          endsAt: new Date(it.ends_at).getTime(),
          status: "ended",
          accentColor: it.accent_color,
          glowColor: it.glow_color,
          description: it.description || "Hadiah eksklusif yang berhasil dimenangkan dari Lelang Nuenime.",
          imageUrl: it.image_url,
        });
      }
    }

    // 2. Ambil dari local storage cache barang lelang yang sudah berhasil diklaim
    const wonKey = `nuenime.lelang.won_items.${userId}`;
    const rawWon = await AsyncStorage.getItem(wonKey);
    if (rawWon) {
      const parsed: LelangItem[] = JSON.parse(rawWon);
      if (Array.isArray(parsed)) {
        for (const it of parsed) {
          if (!ownedMap.has(it.id)) {
            ownedMap.set(it.id, it);
          }
        }
      }
    }

    // 3. Ambil dari local claimed IDs
    const claimedKey = `nuenime.lelang.claimed_items.${userId}`;
    const rawClaimed = await AsyncStorage.getItem(claimedKey);
    if (rawClaimed) {
      const claimedIds: string[] = JSON.parse(rawClaimed);
      const liveItems = await getLelangItems();
      for (const cid of claimedIds) {
        const cleanCid = cid.replace(/^hasil-/, "").replace(/^rw_/, "");
        if (!ownedMap.has(cleanCid)) {
          const match = liveItems.find((l: LelangItem) => l.id === cleanCid);
          if (match) {
            ownedMap.set(cleanCid, { ...match, status: "ended" });
          }
        }
      }
    }
  } catch (err) {
    console.warn("[lelang-service] Failed fetching owned items from Supabase:", err);
  }

  return Array.from(ownedMap.values());
}

/**
 * 7. MEMASANG BORDER / BANNER HASIL LELANG KE PROFIL AKUN (TERHUBUNG LANGSUNG DENGAN MENU BORDER & PROFILE)
 */
export async function equipLelangItem(
  item: LelangItem,
  userId?: string | null
): Promise<{ success: boolean; message: string }> {
  try {
    const borderOrBannerId = item.sourceId || item.id;
    const isCurrentlyEquipped = await isLelangItemEquipped(item, userId);

    if (item.type === "border") {
      // 1. Pastikan border terdaftar di koleksi border yang dimiliki akun (avatar-decorations & Supabase)
      const currentOwned = await getOwnedBorderIds(userId);
      if (!currentOwned.includes(borderOrBannerId)) {
        const nextOwned = [...currentOwned, borderOrBannerId];
        await setOwnedBorderIds(userId, nextOwned);
      }

      if (isCurrentlyEquipped) {
        // Lepas border jika sedang terpasang (sinkron dengan menu border)
        await setEquippedBorderId(userId || null, null);
        return {
          success: true,
          message: `Border "${item.title}" dilepas dari Avatar profil.`,
        };
      } else {
        // Pasang border ke avatar profil (URUTAN PARAMETER RESMI: userId, borderId)
        await setEquippedBorderId(userId || null, borderOrBannerId);
        return {
          success: true,
          message: `Border "${item.title}" berhasil dipasang ke Avatar profil Anda!`,
        };
      }
    } else {
      // 1. Pastikan banner terdaftar di inventory wallpaper akun
      await recordBannerOwnership(userId, [borderOrBannerId]);

      if (isCurrentlyEquipped) {
        // Lepas wallpaper
        await setActiveWallpaperId(userId, null);
        return {
          success: true,
          message: `Banner "${item.title}" dilepas dari header profil.`,
        };
      } else {
        // Pasang wallpaper ke header profil akun
        await setActiveWallpaperId(userId, borderOrBannerId);
        return {
          success: true,
          message: `Banner "${item.title}" berhasil dipasang ke Banner profil Anda!`,
        };
      }
    }
  } catch (err) {
    console.warn("[lelang-service] Gagal memasang item:", err);
    return { success: false, message: "Gagal memproses item." };
  }
}

/**
 * 8. CEK APAKAH ITEM LELANG SEDANG TERPASANG DI PROFIL (SINKRON 100% DENGAN MENU BORDER & PROFIL)
 */
export async function isLelangItemEquipped(
  item: LelangItem,
  userId?: string | null
): Promise<boolean> {
  try {
    const borderOrBannerId = item.sourceId || item.id;

    if (item.type === "border") {
      const current = await getEquippedBorderId(userId);
      return (
        current === borderOrBannerId ||
        current === item.id ||
        (!!item.sourceId && current === item.sourceId)
      );
    } else {
      const current = await getActiveWallpaperId(userId);
      return (
        current === borderOrBannerId ||
        current === item.id ||
        (!!item.sourceId && current === item.sourceId)
      );
    }
  } catch {
    return false;
  }
}

/**
 * 9. MISI HARIAN CRYSTAL LELANG (REAL 1 HARI 1 KALI KLAIM & RESET 00:00 WIB)
 */
function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const INITIAL_LELANG_MISSIONS: LelangMission[] = [
  {
    id: "misi-login",
    title: "Check-in Harian Festival",
    desc: "Buka halaman lelang hari ini untuk mengklaim bonus Crystal harian.",
    rewardCrystal: 150,
    claimed: false,
    progress: 1,
    maxProgress: 1,
    icon: "calendar-check",
    actionText: "Klaim",
  },
  {
    id: "misi-lelang",
    title: "Pasang 1 Tawaran Lelang",
    desc: "Ajukan minimal 1 penawaran pada item lelang aktif hari ini.",
    rewardCrystal: 200,
    claimed: false,
    progress: 0,
    maxProgress: 1,
    icon: "gavel",
    actionText: "Tawar",
  },
  {
    id: "misi-nobar",
    title: "Kunjungi Room Nobar",
    desc: "Masuk dan ikuti keseruan nonton bersama di fitur Nobar Anime.",
    rewardCrystal: 250,
    claimed: false,
    progress: 0,
    maxProgress: 1,
    icon: "television-play",
    actionText: "Nobar",
    actionRoute: "/nobar",
  },
  {
    id: "misi-anime",
    title: "Tonton 1 Episode Anime",
    desc: "Nikmati tayangan episode anime favoritmu di Nuenime hari ini.",
    rewardCrystal: 300,
    claimed: false,
    progress: 0,
    maxProgress: 1,
    icon: "play-circle-outline",
    actionText: "Tonton",
    actionRoute: "/(tabs)",
  },
];

export async function getLelangMissions(userId?: string | null): Promise<LelangMission[]> {
  if (!userId || userId === "guest") {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user?.id) userId = data.session.user.id;
    } catch {}
  }

  const today = getTodayDateString();
  const userKey = userId || "guest";
  const key = `${STORAGE_LELANG_MISSIONS}${userKey}`;
  const lastResetKey = `${STORAGE_LELANG_MISSIONS}date.${userKey}`;

  let lastDate: string | null = null;
  let missions: LelangMission[] = [];

  try {
    const [savedDate, raw] = await Promise.all([
      AsyncStorage.getItem(lastResetKey),
      AsyncStorage.getItem(key),
    ]);
    lastDate = savedDate;
    if (raw) {
      missions = JSON.parse(raw);
    }
  } catch {}

  const initialIds = INITIAL_LELANG_MISSIONS.map((m) => m.id);
  const isValidList =
    Array.isArray(missions) &&
    missions.length === INITIAL_LELANG_MISSIONS.length &&
    initialIds.every((id) => missions.some((m) => m.id === id));

  // Reset otomatis jika hari baru atau jika struktur misi belum cocok
  if (!lastDate || lastDate !== today || !isValidList) {
    const isNewDay = lastDate !== today;

    missions = INITIAL_LELANG_MISSIONS.map((base) => {
      const existing = Array.isArray(missions) ? missions.find((m) => m.id === base.id) : null;
      if (isNewDay) {
        // Hari baru: reset status klaim dan progres (kecuali login check-in otomatis 1)
        return {
          ...base,
          claimed: false,
          lastClaimedDate: "",
          progress: base.id === "misi-login" ? 1 : 0,
        };
      } else {
        // Hari yang sama (migrasi / upgrade struktur)
        const wasClaimedToday =
          existing?.lastClaimedDate === today || (existing?.claimed && lastDate === today);
        return {
          ...base,
          claimed: !!wasClaimedToday,
          lastClaimedDate: wasClaimedToday ? today : "",
          progress: existing ? existing.progress : (base.id === "misi-login" ? 1 : 0),
        };
      }
    });

    await AsyncStorage.setItem(key, JSON.stringify(missions));
    await AsyncStorage.setItem(lastResetKey, today);
    return missions;
  }

  // Hari yang sama: pastikan aturan 1 hari 1 kali & check-in lelang
  let changed = false;
  for (const m of missions) {
    if (m.lastClaimedDate === today) {
      if (!m.claimed) {
        m.claimed = true;
        changed = true;
      }
    }

    // Check-in harian otomatis selesai (1/1) saat pengguna membuka lelang
    if (m.id === "misi-login" && m.progress < 1) {
      m.progress = 1;
      changed = true;
    }
  }

  if (changed) {
    await AsyncStorage.setItem(key, JSON.stringify(missions));
  }

  return missions;
}

export async function claimLelangMission(
  missionId: string,
  userId?: string | null
): Promise<{ success: boolean; reward: number; error?: string }> {
  if (!userId || userId === "guest") {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user?.id) userId = data.session.user.id;
    } catch {}
  }

  const today = getTodayDateString();
  const userKey = userId || "guest";
  const key = `${STORAGE_LELANG_MISSIONS}${userKey}`;
  const missions = await getLelangMissions(userId);
  const m = missions.find((i) => i.id === missionId);

  if (!m) {
    return { success: false, reward: 0, error: "Misi tidak ditemukan." };
  }

  // ATURAN KETAT: 1 HARI 1 KALI KLAIM
  if (m.claimed || m.lastClaimedDate === today) {
    return {
      success: false,
      reward: 0,
      error: "Misi ini sudah kamu klaim hari ini! Reset setiap hari pukul 00:00 WIB.",
    };
  }

  if (m.progress < m.maxProgress) {
    return {
      success: false,
      reward: 0,
      error: "Misi belum terselesaikan. Selesaikan syarat misi terlebih dahulu untuk klaim!",
    };
  }

  // Kunci status klaim untuk tanggal hari ini
  m.claimed = true;
  m.lastClaimedDate = today;
  await AsyncStorage.setItem(key, JSON.stringify(missions));

  // Tambah Crystal ke akun pengguna (via addCrystalBalance yang memanggil RPC atomik)
  try {
    await addCrystalBalance(userId, m.rewardCrystal, `Hadiah Misi Lelang: ${m.title}`);
  } catch (err) {
    console.warn("Failed to add crystal balance on claim:", err);
  }

  return { success: true, reward: m.rewardCrystal };
}

export async function markMissionProgress(
  missionId: string,
  userId?: string | null
): Promise<void> {
  try {
    if (!userId || userId === "guest") {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user?.id) userId = data.session.user.id;
    }
    const userKey = userId || "guest";
    const key = `${STORAGE_LELANG_MISSIONS}${userKey}`;
    const missions = await getLelangMissions(userId);
    const m = missions.find((i) => i.id === missionId);
    if (m && !m.claimed && m.progress < m.maxProgress) {
      m.progress = m.maxProgress;
      await AsyncStorage.setItem(key, JSON.stringify(missions));
    }
  } catch {}
}

export async function markLelangBidMission(userId?: string | null): Promise<void> {
  return markMissionProgress("misi-lelang", userId);
}
