import React from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, usePathname } from "expo-router";
import { Icon } from "./ui";

/** Shared navy title bar and rounded content sheet for monitoring list screens. */
export default function IndustrialPage({
  title,
  actions,
  children,
  refreshing = false,
  onRefresh,
  subtitle,
  back = false,
  footer,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  footer?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const pathname = usePathname();
  return (
    <View style={s.root}>
      <LinearGradient colors={["#002B4D", "#001C36"]} style={s.header}>
        <View style={s.heading}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              flex: 1,
            }}
          >
            {back && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                onPress={() =>
                  router.canGoBack()
                    ? router.back()
                    : router.replace(pathname === "/forgot-password" ? "/login" : "/(tabs)/assets")
                }
                style={{ paddingVertical: 10 }}
              >
                <Icon name="arrow-left" color="white" size={22} />
              </Pressable>
            )}
            <View style={{ flex: 1 }}>
              <Text
                accessibilityRole="header"
                style={[s.title, (subtitle || back) && { fontSize: 19 }]}
              >
                {title}
              </Text>
              {!!subtitle && (
                <Text style={{ color: "#D6E9F9", fontSize: 12, marginTop: 3 }}>
                  {subtitle}
                </Text>
              )}
            </View>
          </View>
          {actions ? <View style={s.actions}>{actions}</View> : null}
        </View>
      </LinearGradient>
      <KeyboardAvoidingView
        style={s.sheet}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#0085FF"
              />
            ) : undefined
          }
        >
          <View style={s.content}>{children}</View>
        </ScrollView>
        {footer}
      </KeyboardAvoidingView>
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#001C36" },
  header: { paddingTop: 12, paddingBottom: 23 },
  heading: {
    minHeight: 45,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "white",
    letterSpacing: -0.5,
  },
  actions: { flexDirection: "row", flexShrink: 1, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: 10, maxWidth: "45%" },
  sheet: {
    flex: 1,
    marginTop: -13,
    backgroundColor: "#F8FAFD",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden",
  },
  scroll: { padding: 14, paddingBottom: 28 },
  content: { width: "100%", maxWidth: 680, alignSelf: "center", gap: 13 },
});
