import React, { useEffect, useState } from "react";
import { Image, View, Text } from "react-native";
import { Profile } from "../types/models";
export default function UserAvatar({
  profile,
  size = 74,
}: {
  profile: Profile | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [profile?.avatar_url]);
  const initials =
    profile?.name
      .split(/\s+/)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "RU";
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#EAF4FF",
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: "#D4E8FA",
      }}
    >
      {profile?.avatar_url && !failed ? (
        <Image
          source={{ uri: profile.avatar_url }}
          accessibilityLabel="Profile photo"
          style={{ width: "100%", height: "100%" }}
          onError={() => setFailed(true)}
        />
      ) : (
        <Text
          style={{ fontSize: size * 0.32, fontWeight: "700", color: "#0085FF" }}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}
