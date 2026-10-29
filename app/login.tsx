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
  const { height, width } = useWindowDimensions();
  const compact = height < 720;
  async function submit() {
    if (busy) return;
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }
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
    setBusy(true);
    try {
      await signIn(email.trim(), password, remember);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
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
              paddingTop: compact ? 24 : Math.min(76, height * 0.095),
              paddingHorizontal: width < 380 ? 22 : 32,
            },
          ]}
        >
          <View style={s.content}>
            <View style={s.brand}>
              <RevUpTimeLogo size={compact ? 60 : 72} />
              <Text accessibilityRole="header" style={s.wordmark}>
                Rev<Text style={s.blue}>Up</Text>Time
              </Text>
              <Text style={s.subtitle}>
                AI-Powered{"\n"}Predictive Maintenance{"\n"}for Industrial
                Assets
              </Text>
            </View>
            <View style={[s.form, { marginTop: compact ? 30 : 46 }]}>
              <Text style={s.formTitle}>Welcome back</Text>
              <Text style={s.formSubtitle}>Sign in to continue to your workspace.</Text>
              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>Email address</Text>
                <TextInput
                  accessibilityLabel="Email address"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  placeholder="name@company.com"
                  placeholderTextColor="#718096"
                  onFocus={() => setFocused("email")}
                  onBlur={() => setFocused(null)}
                  style={[s.input, focused === "email" && s.focused]}
                />
              </View>
              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>Password</Text>
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
                    placeholder="Enter your password"
                    placeholderTextColor="#718096"
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
                      color="#52657A"
                    />
                  </Pressable>
                </View>
              </View>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel="Remember me"
                accessibilityState={{ checked: remember }}
                onPress={() => setRemember((value) => !value)}
                style={s.rememberRow}
                hitSlop={6}
              >
                <View style={[s.checkbox, remember && s.checkboxChecked]}>
                  {remember && <Icon name="check" color="white" size={13} />}
                </View>
                <Text style={s.rememberText}>Remember me</Text>
              </Pressable>
              {(error || authError) && (
                <Text accessibilityRole="alert" style={s.error}>
                  {userError(error || authError)}
                </Text>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign In"
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={submit}
                style={({ pressed }) => [
                  s.signIn,
                  { opacity: busy ? 0.7 : pressed ? 0.85 : 1 },
                ]}
              >
                {busy ? (
                  <View style={s.loadingButtonContent}>
                    <ActivityIndicator color="white" size="small" />
                    <Text style={s.signInText}>Signing in…</Text>
                  </View>
                ) : (
                  <Text style={s.signInText}>Sign In</Text>
                )}
              </Pressable>
            </View>
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
    justifyContent: "center",
    paddingBottom: 36,
  },
  content: { width: "100%", maxWidth: 380 },
  brand: { alignItems: "center" },
  wordmark: {
    fontSize: 36,
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
  form: {
    width: "100%",
    padding: 24,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(0,18,34,0.78)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 28,
    elevation: 12,
  },
  formTitle: {
    color: "white",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    marginBottom: 4,
  },
  formSubtitle: {
    color: "#AFC3D5",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 24,
  },
  fieldGroup: { marginBottom: 18 },
  fieldLabel: {
    color: "#E8F2FB",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 10,
    minHeight: 32,
    marginTop: -4,
    marginBottom: 16,
    paddingVertical: 4,
  },
  checkbox: {
    width: 19,
    height: 19,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#AFC3D5",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    borderColor: "#1388F5",
    backgroundColor: "#1388F5",
  },
  rememberText: {
    color: "#E8F2FB",
    fontSize: 13,
    fontWeight: "500",
  },
  input: {
    width: "100%",
    height: 52,
    borderWidth: 1,
    borderColor: "#DBE2E9",
    borderRadius: 11,
    backgroundColor: "#FFF",
    paddingHorizontal: 16,
    color: "#0F1E3A",
    fontSize: 15,
  },
  passwordField: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#DBE2E9",
    backgroundColor: "#FFF",
  },
  passwordInput: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 16,
    fontSize: 15,
    color: "#0F1E3A",
    letterSpacing: 0,
  },
  eye: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  focused: { borderColor: "#168DF0", borderWidth: 2 },
  error: {
    color: "#FFD0D5",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  signIn: {
    width: "100%",
    height: 52,
    borderRadius: 11,
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
  loadingButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
});
