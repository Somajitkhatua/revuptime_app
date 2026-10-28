import React, { useEffect, useState } from "react";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { Screen, Card, T, Button, ErrorMessage } from "../../components/ui";
import { client } from "../../services/supabase";
export default function Confirm() {
  const url = Linking.useURL(),
    [error, setError] = useState<unknown>(),
    [done, setDone] = useState(false);
  useEffect(() => {
    let active = true;
    async function finish() {
      try {
        const current =
          url || (typeof window !== "undefined" ? window.location.href : "");
        const parsed = new URL(current || "revuptime://auth/confirm");
        const params = new URLSearchParams(parsed.hash.slice(1));
        if (params.get("error_description"))
          throw new Error(params.get("error_description")!);
        const access = params.get("access_token"),
          refresh = params.get("refresh_token"),
          code = parsed.searchParams.get("code");
        if (access && refresh) {
          const { error } = await client().auth.setSession({
            access_token: access,
            refresh_token: refresh,
          });
          if (error) throw error;
        } else if (code) {
          const { error } = await client().auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          const { data } = await client().auth.getSession();
          if (!data.session)
            throw new Error(
              "This verification link is missing or expired. Request a new email.",
            );
        }
        if (active) setDone(true);
      } catch (e) {
        if (active) setError(e);
      }
    }
    finish();
    return () => {
      active = false;
    };
  }, [url]);
  return (
    <Screen title="Email verification">
      <Card style={{ gap: 16 }}>
        <T>
          {done
            ? "Your email is verified. You can now access your workspace."
            : "Verifying your email…"}
        </T>
        <ErrorMessage error={error} />
        <Button
          title={done ? "Continue to workspace" : "Return to sign in"}
          onPress={() => router.replace(done ? "/(tabs)/dashboard" : "/login")}
        />
      </Card>
    </Screen>
  );
}
