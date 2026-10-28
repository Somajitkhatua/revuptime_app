import React, { useEffect, useRef } from "react";
import { Stack, router, useSegments, usePathname } from "expo-router";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { AppProvider, useApp } from "../providers/AppProvider";
import { State } from "../components/ui";
import type { ErrorBoundaryProps } from "expo-router";
import RecoveryScreen from "../components/RecoveryScreen";
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <RecoveryScreen retry={retry} />;
}
function Navigation() {
  const handledNotification = useRef("");
  const { profile, loading } = useApp(),
    segments = useSegments();
  useEffect(() => {
    if (loading) return;
    const publicRoute = [
      "login",
      "forgot-password",
      "register",
      "verify-email",
      "auth",
    ].includes(segments[0] || "");
    if (!profile && !publicRoute) router.replace("/login");
    if (profile && segments[0] === "login") router.replace("/(tabs)/dashboard");
  }, [profile, loading, segments]);
  useEffect(() => {
    if (
      Platform.OS === "web" ||
      !profile ||
      loading ||
      Constants.executionEnvironment === ExecutionEnvironment.StoreClient
    )
      return;
    let disposed = false;
    let subscription: { remove: () => void } | undefined;
    import("expo-notifications")
      .then((n) => {
        if (disposed) return;
        const openNotification = (
          response: import("expo-notifications").NotificationResponse | null,
        ) => {
          if (!response || disposed) return;
          const identifier = response.notification.request.identifier;
          if (handledNotification.current === identifier) return;
          const d = response.notification.request.content.data || {};
          const uuid =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          handledNotification.current = identifier;
          if (typeof d.alert_id === "string" && uuid.test(d.alert_id))
            router.push(`/alert/${d.alert_id}`);
          else if (
            typeof d.work_order_id === "string" &&
            uuid.test(d.work_order_id)
          )
            router.push(`/work-order/${d.work_order_id}`);
        };
        subscription =
          n.addNotificationResponseReceivedListener(openNotification);
        return n.getLastNotificationResponseAsync().then(openNotification);
      })
      .catch((error) =>
        console.warn("Notification listener unavailable", error),
      );
    return () => {
      disposed = true;
      subscription?.remove();
    };
  }, [profile?.id, loading]);
  if (loading) return <State loading />;
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#F6F8FB" },
        animation: "slide_from_right",
      }}
    />
  );
}
export default function Root() {
  const home = usePathname() === "/dashboard";
  return (
    <SafeAreaProvider>
      <AppProvider>
        <SafeAreaView
          style={{ flex: 1, backgroundColor: home ? "#F8FBFF" : "#0F1E3A" }}
          edges={["top", "left", "right"]}
        >
          <StatusBar style={home ? "dark" : "light"} />
          <Navigation />
        </SafeAreaView>
      </AppProvider>
    </SafeAreaProvider>
  );
}
