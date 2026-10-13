import * as zModule from "zod";
import { notifyOwner, type NotificationPayload } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";

const z: typeof zModule = (zModule as any).z ?? (zModule as any).default ?? zModule;

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      }),
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      }),
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input as NotificationPayload);
      return {
        success: delivered,
      } as const;
    }),
});
