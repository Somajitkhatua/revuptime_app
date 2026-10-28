import React, { useState } from "react";
import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { router } from "expo-router";
import { Screen, Card, T, Button, ErrorMessage } from "../../components/ui";
import { useApp } from "../../providers/AppProvider";
import { registerPush } from "../../services/notifications";
export default function NotificationSettings() {
  const supportsPush = Platform.OS !== "web" && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
  const { profile } = useApp();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState<unknown>();
  return (
    <Screen title="Notification settings" back>
      <Card style={{ gap: 14 }}>
        <T style={{ fontSize: 18, fontWeight: "700" }}>In-app notifications</T>
        <T muted>
          Review machine alerts and open work orders in your workspace.
        </T>
        <Button
          title="View notifications"
          onPress={() => router.push("/notifications")}
        />
      </Card>
      <Card style={{ gap: 14 }}>
        <T style={{ fontSize: 18, fontWeight: "700" }}>Phone notifications</T>
        <T muted>
          {supportsPush ? "Allow notifications to receive machine alerts on this phone. Your administrator must also enable workspace delivery." : "Phone notifications are available in the installed Android or iOS app. You can view alerts here at any time."}
        </T>
        {supportsPush && <Button
          title="Enable Push Notifications"
          loading={busy}
          onPress={async () => {
            if (!profile || busy) return;
            setBusy(true);
            setError(null);
            try {
              await registerPush(profile.id);
              setMessage("Device registered for push notifications.");
            } catch (e) {
              setError(e);
            } finally {
              setBusy(false);
            }
          }}
        />}
        <ErrorMessage error={error} />
        {!!message && <T>{message}</T>}
      </Card>
    </Screen>
  );
}
