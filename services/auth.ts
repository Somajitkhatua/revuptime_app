import { client, isDemo, isCanonical } from "./supabase";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { DEMO_ORG, DEMO_USER } from "../data/seed";
import { Profile } from "../types/models";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authError } from "../utils/authErrors";
import { getAvatar } from "./profile";
import { getAccountProfile } from "./accountProfile";
import {
  profileInWorkspace,
  workspacePreferenceKey,
  WorkspaceAccessError,
} from "./workspaces";
export const demoProfile: Profile = {
  id: DEMO_USER,
  name: "Rajesh Kumar",
  organization_id: DEMO_ORG,
  role: "Maintenance Manager",
  email: "rajesh@revuptime.com",
};
export async function signIn(
  email: string,
  password: string,
  remember: boolean,
) {
  if (isDemo)
    throw new Error(
      "Live sign-in requires a configured Supabase project. Use Explore demo.",
    );
  const { error } = await client().auth.signInWithPassword({ email, password });
  if (error) throw authError(error);
  await AsyncStorage.setItem("revuptime.remember", String(remember));
}
export async function loadProfile(user: string) {
  if (isCanonical) {
    let data = await getAccountProfile(client(), user);
    const preferred = await AsyncStorage.getItem(workspacePreferenceKey(user));
    if (preferred && preferred !== data.organization_id) {
      try {
        data = await profileInWorkspace(client(), data, preferred);
      } catch (error) {
        if (!(error instanceof WorkspaceAccessError)) throw error;
        await AsyncStorage.removeItem(workspacePreferenceKey(user));
      }
    }
    return { ...data, ...(await getAvatar(user)) } as Profile;
  }
  const { data, error } = await client()
    .from("profiles")
    .select("*")
    .eq("id", user)
    .single();
  if (error) throw error;
  const { data: member, error: memberError } = await client()
    .from("organization_members")
    .select("role")
    .eq("user_id", user)
    .eq("organization_id", data.organization_id)
    .single();
  if (memberError) throw memberError;
  return { ...data, role: member.role } as Profile;
}
export function authRedirect(path = "auth/confirm") {
  return Platform.OS === "web"
    ? `${window.location.origin}/${path}`
    : Linking.createURL(path);
}
export async function signUp(name: string, email: string, password: string) {
  if (
    !name.trim() ||
    !/^\S+@\S+\.\S+$/.test(email.trim()) ||
    password.length < 10
  )
    throw new Error(
      "Enter your name, a valid email, and a password of at least 10 characters.",
    );
  await AsyncStorage.setItem("revuptime.remember", "true");
  const { data, error } = await client().auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: { full_name: name.trim() },
      emailRedirectTo: authRedirect(),
    },
  });
  if (error) throw authError(error);
  // An empty identities array is Supabase's obfuscated existing-account
  // response. Do not claim that this response sent a verification email.
  return {
    ...data,
    verificationRequested: !(
      data.user &&
      Array.isArray(data.user.identities) &&
      data.user.identities.length === 0
    ),
  };
}
export async function resendVerification(email: string) {
  const { error } = await client().auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: authRedirect() },
  });
  if (error) throw authError(error);
}
export async function verifyEmail(email: string, token: string) {
  if (!/^\d{6,8}$/.test(token.trim()))
    throw new Error("Enter the verification code from your email.");
  const { error } = await client().auth.verifyOtp({
    email,
    token: token.trim(),
    type: "signup",
  });
  if (error) throw error;
}
export async function resetPassword(email: string) {
  const { error } = await client().auth.resetPasswordForEmail(email, {
    redirectTo: authRedirect("forgot-password"),
  });
  if (error) throw error;
}
export async function changePassword(password: string) {
  const { error } = await client().auth.updateUser({ password });
  if (error) throw error;
}
export async function signOut() {
  await AsyncStorage.removeItem("revuptime.demo-session");
  if (!isDemo) {
    const { error } = await client().auth.signOut();
    if (error) throw error;
  }
}
