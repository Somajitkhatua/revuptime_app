import React from "react";
import { View, Text, Pressable } from "react-native";

export default function RecoveryScreen({ retry }: { retry: () => void }) {
  return <View style={{ flex: 1, justifyContent: "center", padding: 28, backgroundColor: "#F8FAFD", gap: 16 }}>
    <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: "700", color: "#102846" }}>Let’s reload this screen</Text>
    <Text style={{ color: "#526580", lineHeight: 22 }}>We couldn’t display this page. Try again. If it keeps happening, restart the app or contact your administrator.</Text>
    <Pressable accessibilityRole="button" onPress={retry} style={{ backgroundColor: "#0085FF", padding: 16, borderRadius: 12, alignItems: "center" }}>
      <Text style={{ color: "white", fontWeight: "700" }}>Try again</Text>
    </Pressable>
  </View>;
}
