import { useEffect } from "react";
import { Redirect, useLocalSearchParams } from "expo-router";

export default function MailboxRoute() {
  const params = useLocalSearchParams<{ giftId?: string }>();
  const giftIdParam = params?.giftId ? `&giftId=${params.giftId}` : "";

  return <Redirect href={`/(tabs)?openMailbox=true${giftIdParam}` as any} />;
}

