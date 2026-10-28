import React, { useState, useEffect } from "react";
import * as Linking from "expo-linking";
import { useLocalSearchParams } from "expo-router";
import { Screen, Card, T, Field, Button, ErrorMessage } from "../components/ui";
import { resetPassword, changePassword } from "../services/auth";
import { supabase, isDemo } from "../services/supabase";
export default function Forgot() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [recovery, setRecovery] = useState(mode === "change"),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState<unknown>();
  useEffect(() => {
    async function handle(url: string) {
      const hash = url.split("#")[1];
      if (hash) {
        const p = new URLSearchParams(hash);
        const access_token = p.get("access_token"),
          refresh_token = p.get("refresh_token");
        if (access_token && refresh_token) {
          const { error } = await supabase!.auth.setSession({
            access_token,
            refresh_token,
          });
          if (error) setError(error);
          else setRecovery(true);
        }
      }
    }
    Linking.getInitialURL().then((u) => {
      if (u && supabase) return handle(u);
    });
    const sub = Linking.addEventListener(
      "url",
      (e) => supabase && handle(e.url),
    );
    const auth = supabase?.auth.onAuthStateChange((e) => {
      if (e === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => {
      sub.remove();
      auth?.data.subscription.unsubscribe();
    };
  }, []);
  async function submit() {
    setError(null);
    if (isDemo) {
      setError(
        new Error("Password recovery requires a configured Supabase project."),
      );
      return;
    }
    if (recovery ? password.length < 10 : !/^\S+@\S+\.\S+$/.test(email)) {
      setError(
        new Error(
          recovery
            ? "Use at least 10 characters."
            : "Enter a valid email address.",
        ),
      );
      return;
    }
    setBusy(true);
    try {
      if (recovery) await changePassword(password);
      else await resetPassword(email);
      setDone(true);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen title={recovery ? "Change Password" : "Forgot Password"} back>
      <Card style={{ gap: 20 }}>
        <T>
          {done
            ? recovery
              ? "Password updated."
              : "If this account exists, a recovery link has been sent."
            : "Restore access to your organization workspace."}
        </T>
        {recovery ? (
          <Field
            label="New password"
            value={password}
            onChange={setPassword}
            secure
          />
        ) : (
          <Field
            label="Email"
            value={email}
            onChange={setEmail}
            placeholder="you@company.com"
          />
        )}
        <ErrorMessage error={error} />
        <Button
          title={recovery ? "Update Password" : "Send Recovery Link"}
          onPress={submit}
          loading={busy}
        />
      </Card>
    </Screen>
  );
}
