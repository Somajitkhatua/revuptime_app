import React, { useState } from "react";
import { router } from "expo-router";
import { Screen, Card, Field, Button, T, ErrorMessage } from "../components/ui";
import { signUp } from "../services/auth";
export default function Register() {
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(),
    [notice, setNotice] = useState("");
  async function submit() {
    setError(null);
    setNotice("");
    if (password !== confirm) {
      setError(new Error("Passwords do not match."));
      return;
    }
    setBusy(true);
    try {
      const result = await signUp(name, email, password);
      setPassword("");
      setConfirm("");
      if (result.session) router.replace("/(tabs)/dashboard");
      else if (!result.verificationRequested)
        setNotice(
          "If you already have an account, sign in or reset your password. No new verification email was requested by this response.",
        );
      else
        router.push({
          pathname: "/verify-email",
          params: { email: email.trim().toLowerCase() },
        });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen title="Create account" back>
      <Card style={{ gap: 16 }}>
        <T style={{ fontSize: 22, fontWeight: "700" }}>Welcome to RevUpTime</T>
        <T muted>
          Create your account, verify your email, and start your maintenance
          workspace.
        </T>
        <Field label="Full name" value={name} onChange={setName} />
        <Field label="Email address" value={email} onChange={setEmail} />
        <Field
          label="Password"
          value={password}
          onChange={setPassword}
          secure
        />
        <T muted>Use at least 10 characters.</T>
        <Field
          label="Confirm password"
          value={confirm}
          onChange={setConfirm}
          secure
        />
        <ErrorMessage error={error} />
        {!!notice && <T>{notice}</T>}
        {!!notice && (
          <Button
            title="Reset password"
            secondary
            onPress={() => router.push("/forgot-password")}
          />
        )}
        <Button title="Create account" loading={busy} onPress={submit} />
        <Button
          title="Already have an account? Sign in"
          secondary
          onPress={() => router.replace("/login")}
        />
      </Card>
    </Screen>
  );
}
