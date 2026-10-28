import React from "react";
import { View, Text, Pressable } from "react-native";
import { router, Href } from "expo-router";
import { Screen, Icon, IconName } from "../../components/ui";
import { o, SectionHeading } from "../../components/OperationsUI";
import { useApp } from "../../providers/AppProvider";
import UserAvatar from "../../components/UserAvatar";
export default function More() {
  const { profile } = useApp();
  const groups: {
    title: string;
    items: { label: string; detail: string; icon: IconName; route: string }[];
  }[] = [
    {
      title: "Workspace",
      items: [
        {
          label: "RevUpTime AI",
          detail: "Documents and machine data, with sources",
          icon: "zap",
          route: "/ai",
        },
        {
          label: "Document library",
          detail: "Manuals, indexing and version history",
          icon: "file-text",
          route: "/asset/documents",
        },
        {
          label: "Reports",
          detail: "Plant condition and maintenance summary",
          icon: "bar-chart-2",
          route: "/reports",
        },
        ...(["Owner", "Admin", "Maintenance Manager", "Technician"].includes(
          profile?.role || "",
        )
          ? [
              {
                label: "Inbox",
                detail: "Workspace WhatsApp conversations",
                icon: "message-square" as const,
                route: "/inbox",
              },
            ]
          : []),
      ],
    },
    {
      title: "Devices and configuration",
      items: [
        {
          label: "Devices",
          detail: "Gateways, sensors and reporting status",
          icon: "wifi",
          route: "/devices",
        },
        {
          label: "Measurement points",
          detail: "Machine points, configured zones and sensors",
          icon: "activity",
          route: "/settings/operations?section=points",
        },
        {
          label: "Alert rules",
          detail: "Workspace thresholds and notification rules",
          icon: "sliders",
          route: "/settings/operations?section=rules",
        },
      ],
    },
    {
      title: "Settings",
      items: [
        {
          label: "Organization & team",
          detail: "Workspace details and team roles",
          icon: "users",
          route: "/settings/organization",
        },
        {
          label: "Plants and areas",
          detail: "Your sites and plant locations",
          icon: "map-pin",
          route: "/settings/sites",
        },
        {
          label: "Notifications",
          detail: "Device notification preferences",
          icon: "bell",
          route: "/settings/notifications",
        },
        {
          label: "Help & support",
          detail: "Support and account assistance",
          icon: "help-circle",
          route: "/settings/help",
        },
      ],
    },
  ];
  return (
    <Screen title="More">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open profile"
        onPress={() => router.push("/profile")}
        style={[o.card, o.row]}
      >
        <UserAvatar profile={profile} size={46} />
        <View style={{ flex: 1 }}>
          <Text style={o.title}>{profile?.name}</Text>
          <Text style={o.caption}>
            {profile?.role} · {profile?.email}
          </Text>
        </View>
        <Icon name="chevron-right" />
      </Pressable>
      {groups.map((group) => (
        <View key={group.title} style={{ gap: 10 }}>
          <SectionHeading title={group.title} />
          <View style={[o.card, { paddingVertical: 3 }]}>
            {group.items.map((item, i) => (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={() => router.push(item.route as Href)}
                style={[
                  o.row,
                  {
                    paddingVertical: 15,
                    borderTopWidth: i ? 1 : 0,
                    borderTopColor: "#EDF2F8",
                  },
                ]}
              >
                <View
                  style={{
                    backgroundColor: "#EDF6FF",
                    padding: 10,
                    borderRadius: 11,
                  }}
                >
                  <Icon name={item.icon} color="#0085FF" size={20} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={o.title}>{item.label}</Text>
                  <Text style={o.caption}>{item.detail}</Text>
                </View>
                <Icon name="chevron-right" size={16} />
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </Screen>
  );
}
