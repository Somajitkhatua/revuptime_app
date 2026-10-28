import React from "react";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mobileNavigation } from "../../constants/navigation";
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#0085FF",
        tabBarInactiveTintColor: "#7B8CA0",
        tabBarStyle: {
          backgroundColor: "white",
          borderTopColor: "#E0E8F2",
          height: 68 + insets.bottom,
          paddingTop: 9,
          paddingBottom: 9 + insets.bottom,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
      }}
    >
      {mobileNavigation.map((item) => (
        <Tabs.Screen
          key={item.route}
          name={item.route}
          options={{
            title: item.title,
            tabBarIcon: ({ color, size }) => (
              <Feather name={item.icon} color={color} size={size - 3} />
            ),
          }}
        />
      ))}
      <Tabs.Screen name="alerts" options={{ href: null }} />
      <Tabs.Screen name="ai" options={{ href: null }} />
    </Tabs>
  );
}
