import React, { useState, useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Screen, Card, Field, Button, T, ErrorMessage } from "../components/ui";
import { resendVerification, verifyEmail } from "../services/auth";
import { useApp } from "../providers/AppProvider";
export default function VerifyEmail() {
  const { email = "" } = useLocalSearchParams<{ email: string }>(),
    { profile } = useApp();
  const [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(),
    [message, setMessage] = useState(""),
    [cooldown, setCooldown] = useState(60);
  useEffect(() => {
    if (profile) router.replace("/(tabs)/dashboard");
  }, [profile]);
  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  async function run(resend: boolean) {
    setError(null);
    setBusy(true);
    try {
      if (resend) {
        await resendVerification(email);
        setCooldown(60);
        setMessage(
          "Verification email requested. Check your inbox and spam folder.",
        );
      } else await verifyEmail(email, code);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen title="Verify your email" back>
      <Card style={{ gap: 16 }}>
        <T style={{ fontSize: 22, fontWeight: "700" }}>Check your inbox</T>
        <T>
          Check {email} for a signup verification link or code. Email requests
          do not guarantee delivery; already-verified accounts should sign in
          instead.
        </T>
        <T muted>
          If you have already verified this email, return to sign in. Creating
          the same account again does not necessarily send another email.
        </T>
        <Field
          label="Verification code"
          value={code}
          onChange={setCode}
          numeric
        />
        <ErrorMessage error={error} />
        {!!message && <T>{message}</T>}
        <Button title="Verify code" onPress={() => run(false)} loading={busy} />
        <Button
          title={
            cooldown
              ? `Resend email in ${cooldown}s`
              : "Resend verification email"
          }
          secondary
          disabled={busy || cooldown > 0}
          onPress={() => run(true)}
        />
        <Button
          title="Email verified? Return to sign in"
          secondary
          onPress={() => router.replace("/login")}
        />
      </Card>
    </Screen>
  );
}
