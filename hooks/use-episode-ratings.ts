import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { useExp } from "@/providers/exp-toast-provider";
import { EXP_RULES } from "@/lib/user-level";

export function useEpisodeRatings(animeId?: number) {
  const { user } = useAnirakuAuth();
  const { grantXp } = useExp();
  const queryClient = useQueryClient();
  const queryKey = ["episode-ratings", user?.id, animeId];
  const ratings = useQuery({ queryKey, enabled: Boolean(user && animeId && animeId > 0), queryFn: async () => { const { data, error } = await supabase.from("episode_ratings").select("episode_number, score").eq("user_id", user!.id).eq("anime_id", animeId!); if (error) throw error; return data ?? []; } });
  const setRating = useMutation({ mutationFn: async (input: { episode: number; score: number }) => {
    if (!user || !animeId) throw new Error("Sign in to rate episodes.");
    if (input.score < 1 || input.score > 10) throw new Error("Ratings must be between 1 and 10.");
    const { error } = await supabase.from("episode_ratings").upsert({ user_id: user.id, anime_id: animeId, episode_number: input.episode, score: input.score }, { onConflict: "user_id,anime_id,episode_number" });
    if (error) throw error;

    // Berikan EXP untuk rating episode (hanya sekali per episode)
    void grantXp({
      activityType: EXP_RULES.RATE_EPISODE.type,
      targetId: `${animeId}:${input.episode}`,
      baseXp: EXP_RULES.RATE_EPISODE.xp,
      description: `${EXP_RULES.RATE_EPISODE.label} Ep ${input.episode}`,
      metadata: { anime_id: animeId, episode: input.episode, score: input.score },
    });
  }, onSuccess: () => void queryClient.invalidateQueries({ queryKey }) });
  return { ratings, setRating, scoreFor: (episode: number) => ratings.data?.find((rating) => rating.episode_number === episode)?.score };
}
