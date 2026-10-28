import { SignJWT } from "jose";
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

      // Generate LiveKit Access Token via jose HS256 JWT
      const secretBytes = new TextEncoder().encode(apiSecret);
      const token = await new SignJWT({
        video: {
          room: `nobar_${roomId}`,
          roomJoin: true,
          canPublish: true,
          canSubscribe: true,
          canPublishData: true,
        },
        name: userName,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setIssuer(apiKey)
        .setSubject(userId)
        .setExpirationTime("6h")
        .sign(secretBytes);

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
