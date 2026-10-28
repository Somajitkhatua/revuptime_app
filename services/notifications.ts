import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { client, isDemo } from "./supabase";
export async function registerPush(user: string) {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient)
    throw new Error("Remote push notifications require a development build. Other app features are available in Expo Go.");
  if (Platform.OS === "web")
    throw new Error(
      "Push notifications require an Android or iOS development build.",
    );
  if (isDemo)
    throw new Error("Connect Supabase to register device push tokens.");
  const identity = await client().auth.getUser();
  if (identity.error || identity.data.user?.id !== user)
    throw new Error("Sign in again before enabling notifications.");
  const Notifications = await import("expo-notifications");
  const Device = await import("expo-device");
  if (!Device.isDevice)
    throw new Error("Push notifications require a physical device.");
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("alerts", {
      name: "Asset alerts",
      importance: Notifications.AndroidImportance.HIGH,
    });
  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted")
    throw new Error("Notification permission was not granted.");
  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID || Constants.easConfig?.projectId;
  if (!projectId) throw new Error("Configure an EAS project ID first.");
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  const { error } = await client()
    .from("profiles")
    .update({ push_token: token.data })
    .eq("id", user)
    .select("id")
    .single();
  if (error) throw error;
  return token.data;
}
