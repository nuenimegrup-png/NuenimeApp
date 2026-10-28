import { AccessToken } from "livekit-server-sdk";
import type { Express, Request, Response } from "express";

export function registerLiveKitRoutes(app: Express) {
  app.get("/api/nobar/voice-token", async (req: Request, res: Response) => {
    try {
      const apiKey = process.env.LIVEKIT_API_KEY || "APIEwYtdEeibv9m";
      const apiSecret =
        process.env.LIVEKIT_API_SECRET || "YeBHtQxw0AebOfkbb2wZESAG37Dhi7PbQjKaO2E9yTuA";
      const livekitUrl =
        process.env.LIVEKIT_URL ||
        process.env.EXPO_PUBLIC_LIVEKIT_URL ||
        "wss://nuenime-nobar-h2gtgeqn.livekit.cloud";

      const roomId = String(req.query.roomId || "").trim();
      const userId = String(req.query.userId || "").trim();
      const userName = String(req.query.userName || "Penonton").trim();

      if (!roomId || !userId) {
        res.status(400).json({ error: "Parameter roomId dan userId wajib diisi." });
        return;
      }

      // Generate LiveKit token dengan izin audio publish & subscribe
      const at = new AccessToken(apiKey, apiSecret, {
        identity: userId,
        name: userName,
        ttl: "6h",
      });

      at.addGrant({
        room: `nobar_${roomId}`,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });

      const token = await at.toJwt();

      res.status(200).json({
        success: true,
        token,
        url: livekitUrl,
        room: `nobar_${roomId}`,
      });
    } catch (err: any) {
      console.error("[LiveKit voice-token error]:", err);
      res.status(500).json({ error: "Gagal membuat token suara LiveKit." });
    }
  });
}
