import React, { useState } from "react";
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Icon, IconName } from "../components/ui";
import RevUpTimeLogo from "../components/RevUpTimeLogo";
import { WELCOME_SEEN_KEY } from "../constants/onboarding";

const benefits: { icon: IconName; title: string; detail: string }[] = [
  {
    icon: "activity",
    title: "Spot equipment issues early",
    detail: "Keep an eye on asset health and emerging alerts.",
  },
  {
    icon: "calendar",
    title: "Plan maintenance with confidence",
    detail: "Organize work orders and focus on what needs attention.",
  },
  {
    icon: "trending-up",
    title: "Keep operations moving",
    detail: "Bring asset information and maintenance work together.",
  },
];

export default function Welcome() {
  const [busy, setBusy] = useState(false);
  const { height, width } = useWindowDimensions();
  const compact = height < 760;

  async function continueToLogin() {
    if (busy) return;
    setBusy(true);
    try {
      await AsyncStorage.setItem(WELCOME_SEEN_KEY, "true");
    } catch {
      // Continue to sign-in if local storage is unavailable.
    } finally {
      router.replace("/login");
      setBusy(false);
    }
  }

  return (
    <ImageBackground
      source={require("../assets/industrial-login.jpg")}
      resizeMode="cover"
      style={s.background}
    >
      <LinearGradient
        colors={["rgba(0,22,42,0.72)", "rgba(0,17,33,0.84)"]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          {
            minHeight: height,
            paddingHorizontal: width < 400 ? 22 : 32,
            paddingVertical: compact ? 26 : 48,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.content, { maxWidth: width > 850 ? 560 : 480 }]}>
          <View style={s.brand}>
            <RevUpTimeLogo size={compact ? 56 : 66} />
            <Text style={s.wordmark}>
              Rev<Text style={s.blue}>Up</Text>Time
            </Text>
          </View>

          <View style={s.intro}>
            <Text accessibilityRole="header" style={s.title}>
              Maintenance, made clearer.
            </Text>
            <Text style={s.description}>
              RevUpTime helps your team understand equipment health, plan the
              right work, and keep operations running smoothly.
            </Text>
          </View>

          <View style={s.benefitCard}>
            {benefits.map((benefit, index) => (
              <View
                key={benefit.title}
                style={[
                  s.benefitRow,
                  index < benefits.length - 1 && s.benefitDivider,
                ]}
              >
                <View style={s.iconBox}>
                  <Icon name={benefit.icon} size={19} color="#5BB8EE" />
                </View>
                <View style={s.benefitCopy}>
                  <Text style={s.benefitTitle}>{benefit.title}</Text>
                  <Text style={s.benefitDetail}>{benefit.detail}</Text>
                </View>
              </View>
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue to sign in"
            disabled={busy}
            onPress={continueToLogin}
            style={({ pressed }) => [
              s.button,
              { opacity: busy ? 0.75 : pressed ? 0.88 : 1 },
            ]}
          >
            {busy ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={s.buttonText}>Get started</Text>
            )}
          </Pressable>
          <Text style={s.footer}>Built for reliable, well-planned maintenance.</Text>
        </View>
      </ScrollView>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  background: { flex: 1, backgroundColor: "#001A30" },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { width: "100%" },
  brand: { alignItems: "center", marginBottom: 30 },
  wordmark: {
    color: "white",
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "800",
    letterSpacing: -1,
    marginTop: 4,
  },
  blue: { color: "#1B96FF" },
  intro: { alignItems: "center", marginBottom: 24 },
  title: {
    color: "white",
    fontSize: 30,
    lineHeight: 37,
    fontWeight: "800",
    letterSpacing: -0.7,
    textAlign: "center",
  },
  description: {
    color: "#D3E1ED",
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
    marginTop: 11,
    maxWidth: 460,
  },
  benefitCard: {
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(0,18,34,0.74)",
    marginBottom: 22,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
  },
  benefitDivider: { borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.12)" },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "rgba(27,150,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  benefitCopy: { flex: 1, gap: 3 },
  benefitTitle: { color: "white", fontSize: 14, fontWeight: "700" },
  benefitDetail: { color: "#AFC3D5", fontSize: 12, lineHeight: 18 },
  button: {
    minHeight: 54,
    borderRadius: 12,
    backgroundColor: "#0085FF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0085FF",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 5,
  },
  buttonText: { color: "white", fontSize: 15, fontWeight: "700" },
  footer: {
    color: "#AFC3D5",
    fontSize: 11,
    textAlign: "center",
    marginTop: 15,
  },
});
