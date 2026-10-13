import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  GACHA_SETTINGS,
  RARITY_CONFIG,
  STORAGE_ACTIVE_WALLPAPER,
  STORAGE_CRYSTAL_BALANCE,
  STORAGE_GACHA_HISTORY,
  STORAGE_OWNED_WALLPAPERS,
  WALLPAPER_CATALOG,
  WallpaperItem,
  WallpaperRarity,
  GachaTransaction,
} from "./gacha-data";

/**
 * Get current Daylan Crystal balance.
 * Initializes with GACHA_SETTINGS.defaultInitialBalance (e.g. 1500) if user has never top up / drawn yet.
 */
export async function getCrystalBalance(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_CRYSTAL_BALANCE);
    if (raw === null) {
      // Set initial starting balance for first run
      await AsyncStorage.setItem(STORAGE_CRYSTAL_BALANCE, String(GACHA_SETTINGS.defaultInitialBalance));
      return GACHA_SETTINGS.defaultInitialBalance;
    }
    const val = parseInt(raw, 10);
    return isNaN(val) ? 0 : Math.max(0, val);
  } catch {
    return 0;
  }
}

/**
 * Update Daylan Crystal balance.
 */
export async function setCrystalBalance(balance: number): Promise<number> {
  const safe = Math.max(0, Math.floor(balance));
  await AsyncStorage.setItem(STORAGE_CRYSTAL_BALANCE, String(safe));
  return safe;
}

/**
 * Get IDs of wallpapers owned by user.
 */
export async function getOwnedWallpaperIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_OWNED_WALLPAPERS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Get currently equipped wallpaper ID.
 */
export async function getActiveWallpaperId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_ACTIVE_WALLPAPER);
  } catch {
    return null;
  }
}

/**
 * Set active equipped wallpaper.
 */
export async function setActiveWallpaperId(id: string | null): Promise<void> {
  if (id) {
    await AsyncStorage.setItem(STORAGE_ACTIVE_WALLPAPER, id);
  } else {
    await AsyncStorage.removeItem(STORAGE_ACTIVE_WALLPAPER);
  }
}

/**
 * Weighted Gacha Roll Algorithm based on RARITY_CONFIG rates
 */
function rollSingleItem(): WallpaperItem {
  const rand = Math.random() * 100; // 0 to 100
  let chosenRarity: WallpaperRarity = "Normal";

  if (rand < 2) {
    chosenRarity = "Mythic"; // 2%
  } else if (rand < 10) {
    chosenRarity = "Legendary"; // 8% (2..10)
  } else if (rand < 30) {
    chosenRarity = "Epic"; // 20% (10..30)
  } else if (rand < 60) {
    chosenRarity = "Rare"; // 30% (30..60)
  } else {
    chosenRarity = "Normal"; // 40% (60..100)
  }

  // Filter pool by chosen rarity
  const pool = WALLPAPER_CATALOG.filter((w) => w.rarity === chosenRarity);
  if (pool.length === 0) {
    // Fallback to random any item
    return WALLPAPER_CATALOG[Math.floor(Math.random() * WALLPAPER_CATALOG.length)];
  }

  const selectedIndex = Math.floor(Math.random() * pool.length);
  return pool[selectedIndex];
}

/**
 * Perform Summon 1x or Summon 10x with balance validation, atomic deduction,
 * and saving owned wallpapers & transaction history.
 */
export async function executeGachaSummon(count: 1 | 10): Promise<{
  success: boolean;
  results: WallpaperItem[];
  newBalance: number;
  newOwnedCount: number;
  error?: string;
}> {
  const cost = count === 1 ? GACHA_SETTINGS.cost1x : GACHA_SETTINGS.cost10x;
  const currentBalance = await getCrystalBalance();

  if (currentBalance < cost) {
    return {
      success: false,
      results: [],
      newBalance: currentBalance,
      newOwnedCount: 0,
      error: `Daylan Crystal tidak mencukupi! Anda memiliki ${currentBalance.toLocaleString()} Crystal, dibutuhkan ${cost.toLocaleString()} Crystal.`,
    };
  }

  // Generate results
  const results: WallpaperItem[] = [];
  for (let i = 0; i < count; i++) {
    results.push(rollSingleItem());
  }

  // Deduct balance securely
  const newBalance = currentBalance - cost;
  await setCrystalBalance(newBalance);

  // Update owned wallpapers
  const currentOwned = await getOwnedWallpaperIds();
  const ownedSet = new Set(currentOwned);
  let newlyAdded = 0;

  for (const item of results) {
    if (!ownedSet.has(item.id)) {
      ownedSet.add(item.id);
      newlyAdded++;
    }
  }

  const nextOwned = Array.from(ownedSet);
  await AsyncStorage.setItem(STORAGE_OWNED_WALLPAPERS, JSON.stringify(nextOwned));

  // Record transaction log
  try {
    const tx: GachaTransaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      type: count === 1 ? "single" : "multi",
      cost,
      results,
    };
    const prevHistoryRaw = await AsyncStorage.getItem(STORAGE_GACHA_HISTORY);
    const history: GachaTransaction[] = prevHistoryRaw ? JSON.parse(prevHistoryRaw) : [];
    history.unshift(tx);
    // Keep last 50 transactions
    await AsyncStorage.setItem(STORAGE_GACHA_HISTORY, JSON.stringify(history.slice(0, 50)));
  } catch {}

  return {
    success: true,
    results,
    newBalance,
    newOwnedCount: nextOwned.length,
  };
}

/**
 * Calculate active EXP bonus from currently equipped wallpaper
 */
export async function getEquippedExpBonus(): Promise<number> {
  const activeId = await getActiveWallpaperId();
  if (!activeId) return 0;
  const wallpaper = WALLPAPER_CATALOG.find((w) => w.id === activeId);
  return wallpaper ? wallpaper.expBonus : 0;
}
