import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import { authClockFetch } from "../utils/authClock";
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const isDemo = !url && !key;
export const isCanonical =
  process.env.EXPO_PUBLIC_BACKEND_SCHEMA === "canonical";
if (!!url !== !!key)
  throw new Error(
    "Set both Supabase URL and publishable key, or leave both empty for demo mode.",
  );
export const supabase =
  url && key
    ? createClient(url, key, {
        global: { fetch: authClockFetch(url) },
        auth: {
          storage: AsyncStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: Platform.OS === "web",
        },
      })
    : null;
if (Platform.OS !== "web" && supabase)
  AppState.addEventListener("change", (s) =>
    s === "active"
      ? supabase.auth.startAutoRefresh()
      : supabase.auth.stopAutoRefresh(),
  );
export function client() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}
