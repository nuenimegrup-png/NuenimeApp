import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { supabase } from "@/lib/supabase";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { ExpPopupToast, type ExpToastData } from "@/components/exp-popup-toast";
import { hapticLight, hapticSuccess } from "@/lib/haptics";

export type GrantXpParams = {
  activityType: string;
  targetId: string;
  baseXp: number;
  description: string;
  metadata?: Record<string, any>;
};

export type GrantXpResponse = {
  success: boolean;
  duplicate?: boolean;
  capped?: boolean;
  message?: string;
  activity_type?: string;
  description?: string;
  base_xp?: number;
  bonus_xp?: number;
  total_xp?: number;
  multiplier?: number;
  is_vip?: boolean;
  old_level?: number;
  new_level?: number;
  level_up?: boolean;
  new_total_exp?: number;
};

type ExpToastContextValue = {
  grantXp: (params: GrantXpParams) => Promise<GrantXpResponse>;
  showExpToast: (data: Omit<ExpToastData, "id">) => void;
};

const ExpToastContext = createContext<ExpToastContextValue | null>(null);

export function ExpToastProvider({ children }: PropsWithChildren) {
  const { user, profile, updateProfileExpAndLevel } = useAnirakuAuth();
  const [queue, setQueue] = useState<ExpToastData[]>([]);
  const [activeToast, setActiveToast] = useState<ExpToastData | null>(null);
  const isShowingRef = useRef(false);

  // Proses antrian notifikasi toast satu per satu
  const processNextInQueue = useCallback((nextQueue: ExpToastData[]) => {
    if (nextQueue.length === 0) {
      setActiveToast(null);
      isShowingRef.current = false;
      return;
    }
    const [nextItem, ...remaining] = nextQueue;
    setActiveToast(nextItem);
    setQueue(remaining);
    isShowingRef.current = true;
  }, []);

  const showExpToast = useCallback(
    (data: Omit<ExpToastData, "id">) => {
      const item: ExpToastData = {
        ...data,
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      };

      if (data.levelUp) {
        hapticSuccess();
      } else {
        hapticLight();
      }

      setQueue((prevQueue) => {
        if (!isShowingRef.current && prevQueue.length === 0) {
          setActiveToast(item);
          isShowingRef.current = true;
          return [];
        }
        return [...prevQueue, item];
      });
    },
    []
  );

  const handleDismiss = useCallback(() => {
    setQueue((currentQueue) => {
      processNextInQueue(currentQueue);
      return currentQueue;
    });
  }, [processNextInQueue]);

  const grantXp = useCallback(
    async (params: GrantXpParams): Promise<GrantXpResponse> => {
      if (!user) {
        return {
          success: false,
          message: "Masuk untuk mendapatkan EXP.",
        };
      }

      try {
        const { data, error } = await supabase.rpc("grant_user_xp", {
          p_activity_type: params.activityType,
          p_target_id: String(params.targetId),
          p_base_xp: params.baseXp,
          p_description: params.description,
          p_metadata: params.metadata || {},
        });

        if (error) {
          console.warn("RPC grant_user_xp error:", error.message);
          return { success: false, message: error.message };
        }

        const res = data as GrantXpResponse;

        // Jika berhasil dan bukan duplikat / capped
        if (res?.success && (res.total_xp ?? 0) > 0) {
          // Perbarui state level & EXP user di AuthProvider secara sinkron
          if (typeof res.new_total_exp === "number" && typeof res.new_level === "number") {
            updateProfileExpAndLevel(res.new_total_exp, res.new_level);
          }

          // Munculkan Pop-up Toast hanya setelah transaksi diverifikasi backend
          showExpToast({
            totalXp: res.total_xp ?? params.baseXp,
            baseXp: res.base_xp ?? params.baseXp,
            bonusXp: res.bonus_xp ?? 0,
            description: res.description || params.description,
            level: res.new_level ?? profile?.level ?? 1,
            oldLevel: res.old_level,
            levelUp: Boolean(res.level_up),
            newTotalXp: res.new_total_exp ?? (profile?.exp ?? 0) + (res.total_xp ?? params.baseXp),
            isVip: Boolean(res.is_vip),
          });
        }

        return res || { success: false };
      } catch (err: any) {
        console.warn("Exception in grantXp:", err);
        return { success: false, message: err?.message || "Gagal memberikan EXP" };
      }
    },
    [user, profile?.level, profile?.exp, updateProfileExpAndLevel, showExpToast]
  );

  return (
    <ExpToastContext.Provider value={{ grantXp, showExpToast }}>
      {children}
      <ExpPopupToast data={activeToast} onDismiss={handleDismiss} />
    </ExpToastContext.Provider>
  );
}

export function useExp() {
  const context = useContext(ExpToastContext);
  if (!context) {
    throw new Error("useExp must be used within ExpToastProvider.");
  }
  return context;
}
