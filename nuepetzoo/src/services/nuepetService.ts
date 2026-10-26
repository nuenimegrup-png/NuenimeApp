import { createClient } from '@supabase/supabase-js';
import { IslandThemeId, OwnedPetInstance, SkyAtmosphereId } from '../types/pet';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://liqekmhmsanihjbyzjvm.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcWVrbWhtc2FuaWhqYnl6anZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NTE0MjMsImV4cCI6MjEwNzEyNzQyM30.q85SL_i9pGaBR3fyGwCaJ3bjBXy6GY8C0uPQ_kT4i60';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface NuePetSyncResult {
  success: boolean;
  coins: number;
  crystals: number;
  activeIslandId: IslandThemeId;
  activeSkyId: SkyAtmosphereId;
  unlockedIslandIds: IslandThemeId[];
  unlockedSkyIds: SkyAtmosphereId[];
  lastClaimAt: number;
  lastChestClaimAt: number | null;
  pets: OwnedPetInstance[];
}

/**
 * Mengirim pesan ke React Native Webview pembungkus (app/nuepet.tsx)
 */
export function notifyParentApp(payload: any) {
  try {
    if (typeof window !== 'undefined') {
      if ((window as any).ReactNativeWebView) {
        (window as any).ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(payload, '*');
      }
    }
  } catch {}
}

/**
 * 1. SINKRONISASI AKUN: Memuat data state pet, saldo koin, dan crystal akun pengguna
 */
export async function syncNuePetAccount(
  userId: string
): Promise<NuePetSyncResult | null> {
  if (!userId || userId === 'guest') return null;

  try {
    const { data, error } = await supabase.rpc('nuepet_sync_account', {
      p_user_id: userId,
    });

    if (error) {
      console.warn('RPC nuepet_sync_account error:', error.message);
      return null;
    }

    if (data && data.success) {
      return {
        success: true,
        coins: Number(data.coins) || 0,
        crystals: Number(data.crystals) || 0,
        activeIslandId: data.activeIslandId || 'dc_island_1',
        activeSkyId: data.activeSkyId || 'siang_cerah',
        unlockedIslandIds: Array.isArray(data.unlockedIslandIds)
          ? data.unlockedIslandIds
          : ['dc_island_1'],
        unlockedSkyIds: Array.isArray(data.unlockedSkyIds)
          ? data.unlockedSkyIds
          : ['siang_cerah'],
        lastClaimAt: Number(data.lastClaimAt) || Date.now(),
        lastChestClaimAt: data.lastChestClaimAt
          ? Number(data.lastChestClaimAt)
          : null,
        pets: Array.isArray(data.pets) ? data.pets : [],
      };
    }
  } catch (err) {
    console.warn('Gagal sinkron akun NuePet Zoo:', err);
  }
  return null;
}

/**
 * 2. KLAIM KOIN: Mengakumulasi koin pasif pet secara presisi
 */
export async function claimPassiveCoins(
  userId: string,
  amount: number
): Promise<{ success: boolean; newTotalCoins: number } | null> {
  if (!userId || userId === 'guest' || amount <= 0) return null;

  try {
    const { data, error } = await supabase.rpc('nuepet_claim_coins', {
      p_user_id: userId,
      p_amount: Math.floor(amount),
    });

    if (!error && data?.success) {
      return {
        success: true,
        newTotalCoins: Number(data.newTotalCoins) || 0,
      };
    }
  } catch (err) {
    console.warn('Gagal klaim koin ke Supabase:', err);
  }
  return null;
}

/**
 * 3. TUKAR KOIN KE CRYSTAL (Aturan Resmi: 50.000 Koin = 5.000 Crystal, Rasio 10:1)
 */
export async function convertCoinsToCrystals(
  userId: string,
  coinsToConvert: number
): Promise<{
  success: boolean;
  coinsConverted: number;
  crystalsGained: number;
  newTotalCoins: number;
  newTotalCrystals: number;
} | null> {
  if (!userId || userId === 'guest' || coinsToConvert < 10) return null;

  try {
    const { data, error } = await supabase.rpc(
      'nuepet_convert_coins_to_crystals',
      {
        p_user_id: userId,
        p_coins: Math.floor(coinsToConvert),
      }
    );

    if (error) {
      throw new Error(error.message);
    }

    if (data && data.success) {
      notifyParentApp({
        type: 'UPDATE_CRYSTALS',
        crystals: Number(data.newTotalCrystals),
      });

      return {
        success: true,
        coinsConverted: Number(data.coinsConverted) || 0,
        crystalsGained: Number(data.crystalsGained) || 0,
        newTotalCoins: Number(data.newTotalCoins) || 0,
        newTotalCrystals: Number(data.newTotalCrystals) || 0,
      };
    }
  } catch (err: any) {
    console.warn('Gagal menukar koin ke crystal:', err);
    throw err;
  }
  return null;
}

/**
 * 4. GACHA DRAW MENGGUNAKAN CRYSTAL AKUN (1x = 500 Crystal, 10x = 5.000 Crystal)
 */
export async function performGachaWithCrystals(
  userId: string,
  drawCount: 1 | 10,
  newPets: OwnedPetInstance[]
): Promise<{ success: boolean; newTotalCrystals: number } | null> {
  if (!userId || userId === 'guest') return null;

  try {
    const { data, error } = await supabase.rpc('nuepet_gacha_draw', {
      p_user_id: userId,
      p_draw_count: drawCount,
      p_rolled_pets: newPets.map((p) => ({
        instanceId: p.instanceId,
        speciesId: p.speciesId,
        nickname: p.nickname,
        star: p.star || 1,
        level: p.level || 1,
        isDeployed: Boolean(p.isDeployed),
      })),
    });

    if (error) {
      throw new Error(error.message);
    }

    if (data && data.success) {
      notifyParentApp({
        type: 'UPDATE_CRYSTALS',
        crystals: Number(data.newTotalCrystals),
      });

      return {
        success: true,
        newTotalCrystals: Number(data.newTotalCrystals) || 0,
      };
    }
  } catch (err: any) {
    console.warn('Gagal eksekusi Gacha Crystal:', err);
    throw err;
  }
  return null;
}

/**
 * 5. SIMPAN STATE GAME: Deploy, Star level, Pulau & Langit aktif
 */
export async function saveNuePetState(
  userId: string,
  coins: number,
  activeIslandId: IslandThemeId,
  activeSkyId: SkyAtmosphereId,
  unlockedIslandIds: IslandThemeId[],
  unlockedSkyIds: SkyAtmosphereId[],
  pets: OwnedPetInstance[]
): Promise<boolean> {
  if (!userId || userId === 'guest') return false;

  try {
    const { data, error } = await supabase.rpc('nuepet_save_state', {
      p_user_id: userId,
      p_coins: Math.floor(coins),
      p_active_island: activeIslandId,
      p_active_sky: activeSkyId,
      p_unlocked_islands: unlockedIslandIds,
      p_unlocked_skies: unlockedSkyIds,
      p_pets: pets.map((p) => ({
        instanceId: p.instanceId,
        speciesId: p.speciesId,
        nickname: p.nickname,
        star: p.star || 1,
        level: p.level || 1,
        isDeployed: Boolean(p.isDeployed),
      })),
    });

    return Boolean(!error && data?.success);
  } catch (err) {
    console.warn('Gagal simpan state NuePet:', err);
    return false;
  }
}

/**
 * 6. KLAIM HADIAH PETI HARTA 7 JAM: Menyimpan Crystal & Koin sungguhan ke Supabase
 */
export async function claimChestReward(
  userId: string,
  crystals: number,
  coins: number
): Promise<{
  success: boolean;
  newTotalCrystals: number;
  newTotalCoins: number;
  nextClaimAt: number;
} | null> {
  if (!userId || userId === 'guest') {
    notifyParentApp({
      type: 'ADD_CRYSTALS',
      amount: crystals,
    });
    return null;
  }

  try {
    const { data, error } = await supabase.rpc('nuepet_claim_chest_reward', {
      p_user_id: userId,
      p_crystals: crystals,
      p_coins: coins,
    });

    if (!error && data && data.success) {
      notifyParentApp({
        type: 'UPDATE_CRYSTALS',
        crystals: Number(data.newTotalCrystals),
      });

      return {
        success: true,
        newTotalCrystals: Number(data.newTotalCrystals),
        newTotalCoins: Number(data.newTotalCoins),
        nextClaimAt: Number(data.nextClaimAt),
      };
    }
  } catch (err) {
    console.warn(
      'RPC nuepet_claim_chest_reward gagal, mencoba fallback direct update:',
      err
    );
  }

  // Fallback direct update jika RPC belum dijalankan di database
  try {
    // 1. Tambah koin di nuepet_user_states
    const { data: stateData } = await supabase
      .from('nuepet_user_states')
      .select('coins')
      .eq('user_id', userId)
      .maybeSingle();

    const currCoins = Number(stateData?.coins) || 0;
    const nextCoins = currCoins + coins;

    await supabase
      .from('nuepet_user_states')
      .update({
        coins: nextCoins,
        last_chest_claim_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    // 2. Tambah crystal di user_balances
    const { data: balData } = await supabase
      .from('user_balances')
      .select('crystal_balance')
      .eq('user_id', userId)
      .maybeSingle();

    const currCrystals = Number(balData?.crystal_balance) || 0;
    const nextCrystals = currCrystals + crystals;

    await supabase
      .from('user_balances')
      .upsert(
        {
          user_id: userId,
          crystal_balance: nextCrystals,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    notifyParentApp({
      type: 'UPDATE_CRYSTALS',
      crystals: nextCrystals,
    });

    notifyParentApp({
      type: 'ADD_CRYSTALS',
      amount: crystals,
    });

    return {
      success: true,
      newTotalCrystals: nextCrystals,
      newTotalCoins: nextCoins,
      nextClaimAt: Date.now() + 7 * 60 * 60 * 1000,
    };
  } catch (fallbackErr) {
    console.warn('Gagal klaim hadiah peti via fallback:', fallbackErr);
    notifyParentApp({
      type: 'ADD_CRYSTALS',
      amount: crystals,
    });
    return null;
  }
}

