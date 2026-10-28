import React, { useState } from "react";
import { userError } from "../utils/userError";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Icon } from "../components/ui";
import RevUpTimeLogo from "../components/RevUpTimeLogo";
import { signIn } from "../services/auth";
import { isDemo } from "../services/supabase";
import { useApp } from "../providers/AppProvider";

/** Native implementation of the Stitch login design, matched to the supplied mockup. */
export default function Login() {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [show, setShow] = useState(false),
    [remember, setRemember] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [focused, setFocused] = useState<"email" | "password" | null>(null);
  const { enterDemo, authError } = useApp();
  const { height } = useWindowDimensions();
  const compact = height < 720;
  async function submit() {
    setError(null);
    if (isDemo) {
      setBusy(true);
      try {
        await enterDemo();
        router.replace("/(tabs)/dashboard");
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim()) || !password) {
      setError("Enter a valid email and password.");
      return;
    }
    setBusy(true);
    try {
      await signIn(email.trim(), password, remember);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function exploreDemo() {
    try {
      await enterDemo();
      router.replace("/(tabs)/dashboard");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <ImageBackground
      source={require("../assets/industrial-login.jpg")}
      resizeMode="cover"
      imageStyle={{ width: "100%", height: "100%" }}
      style={s.background}
    >
      <LinearGradient
        colors={[
          "rgba(0,26,48,0.62)",
          "rgba(0,26,48,0.48)",
          "rgba(0,15,30,0.78)",
        ]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        style={s.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            s.scroll,
            {
              minHeight: height,
              paddingTop: compact ? 40 : Math.min(100, height * 0.114),
            },
          ]}
        >
          <View style={s.content}>
            <View style={s.brand}>
              <RevUpTimeLogo size={compact ? 68 : 84} />
              <Text accessibilityRole="header" style={s.wordmark}>
                Rev<Text style={s.blue}>Up</Text>Time
              </Text>
              <Text style={s.subtitle}>
                AI-Powered{"\n"}Predictive Maintenance{"\n"}for Industrial
                Assets
              </Text>
            </View>
            <View style={[s.form, { marginTop: compact ? 38 : 74 }]}>
              <TextInput
                accessibilityLabel="Email address"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                placeholder="name@company.com"
                placeholderTextColor="#34475D"
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused(null)}
                style={[s.input, focused === "email" && s.focused]}
              />
              <View
                style={[s.passwordField, focused === "password" && s.focused]}
              >
                <TextInput
                  accessibilityLabel="Password"
                  value={password}
                  onChangeText={setPassword}
                  onSubmitEditing={submit}
                  returnKeyType="go"
                  secureTextEntry={!show}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  placeholderTextColor="#0F1E3A"
                  onFocus={() => setFocused("password")}
                  onBlur={() => setFocused(null)}
                  style={s.passwordInput}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={show ? "Hide password" : "Show password"}
                  onPress={() => setShow(!show)}
                  hitSlop={8}
                  style={s.eye}
                >
                  <Icon
                    name={show ? "eye-off" : "eye"}
                    size={19}
                    color="#34475D"
                  />
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel="Remember me"
                accessibilityState={{ checked: remember }}
                onPress={() => setRemember(!remember)}
                style={s.remember}
                hitSlop={6}
              >
                <View style={[s.checkbox, !remember && s.unchecked]}>
                  {remember && <Icon name="check" color="white" size={13} />}
                </View>
                <Text style={s.rememberText}>Remember me</Text>
              </Pressable>
              {isDemo && (
                <Text style={s.demoNotice}>
                  Demo mode · Sign In opens the sample workspace.
                </Text>
              )}
              {(error || authError) && (
                <Text accessibilityRole="alert" style={s.error}>
                  {userError(error || authError)}
                </Text>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign In"
                disabled={busy}
                onPress={submit}
                style={({ pressed }) => [
                  s.signIn,
                  { opacity: busy ? 0.7 : pressed ? 0.85 : 1 },
                ]}
              >
                {busy ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={s.signInText}>Sign In</Text>
                )}
              </Pressable>
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push("/forgot-password")}
                style={s.forgot}
              >
                <Text style={s.forgotText}>Forgot Password?</Text>
              </Pressable>
              {!isDemo && (
                <Pressable
                  accessibilityRole="link"
                  onPress={() => router.push("/register")}
                  style={s.forgot}
                >
                  <Text style={s.forgotText}>
                    New to RevUpTime? Create account
                  </Text>
                </Pressable>
              )}
            </View>
            {isDemo && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Explore demo workspace"
                onPress={exploreDemo}
                style={s.demo}
              >
                <Text style={s.demoText}>
                  Explore demo workspace{" "}
                  <Text style={{ color: "#5BB8EE" }}>→</Text>
                </Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}
const s = StyleSheet.create({
  fill: { flex: 1 },
  background: { flex: 1, backgroundColor: "#001A30" },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 30,
    paddingBottom: 36,
  },
  content: { width: "100%", maxWidth: 330 },
  brand: { alignItems: "center" },
  wordmark: {
    fontSize: 40,
    lineHeight: 48,
    fontWeight: "800",
    color: "white",
    letterSpacing: -1.5,
    marginTop: 6,
    textAlign: "center",
  },
  blue: { color: "#1B96FF" },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: "white",
    textAlign: "center",
    marginTop: 8,
    fontWeight: "500",
    textShadowColor: "#001020",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  form: { width: "100%" },
  input: {
    width: "100%",
    height: 54,
    borderWidth: 1,
    borderColor: "#DBE2E9",
    borderRadius: 10,
    backgroundColor: "#FFF",
    paddingHorizontal: 16,
    color: "#0F1E3A",
    fontSize: 14,
    marginBottom: 14,
  },
  passwordField: {
    flexDirection: "row",
    alignItems: "center",
    height: 54,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DBE2E9",
    backgroundColor: "#FFF",
  },
  passwordInput: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#0F1E3A",
    letterSpacing: 2,
  },
  eye: {
    width: 48,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  focused: { borderColor: "#1B96FF", borderWidth: 2 },
  remember: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    alignSelf: "flex-start",
    marginTop: 17,
    marginBottom: 27,
    minHeight: 24,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: "#0085FF",
    borderWidth: 1,
    borderColor: "#1B96FF",
    alignItems: "center",
    justifyContent: "center",
  },
  unchecked: { backgroundColor: "transparent", borderColor: "#B6C5D5" },
  rememberText: { color: "white", fontSize: 13 },
  demoNotice: {
    color: "#D4E5F5",
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 12,
    textAlign: "center",
  },
  error: { color: "#FFB2BC", fontSize: 12, lineHeight: 18, marginBottom: 14 },
  signIn: {
    width: "100%",
    height: 54,
    borderRadius: 10,
    backgroundColor: "#0085FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2396FF",
    shadowColor: "#0085FF",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  signInText: { color: "white", fontSize: 15, fontWeight: "700" },
  forgot: { alignSelf: "center", padding: 14, marginTop: 10 },
  forgotText: { color: "white", fontSize: 13 },
  demo: { alignSelf: "center", padding: 12, marginTop: 48 },
  demoText: { color: "#BBCCDD", fontSize: 11 },
});
