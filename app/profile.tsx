import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  Screen,
  Card,
  T,
  Badge,
  Icon,
  Button,
  ErrorMessage,
  styles,
} from "../components/ui";
import { useApp } from "../providers/AppProvider";
import { useOrg } from "../hooks/queries";
import { getOrganization } from "../services/organizations";
import appConfig from "../app.json";
import * as ImagePicker from "expo-image-picker";
import UserAvatar from "../components/UserAvatar";
import { uploadAvatar } from "../services/profile";
export default function Profile() {
  const { profile, logout, refreshProfile } = useApp(),
    org = useOrg(),
    organization = useQuery({
      queryKey: ["organization", org],
      queryFn: () => getOrganization(org),
      enabled: !!org,
    }),
    [error, setError] = useState<unknown>(),
    [photoError, setPhotoError] = useState<unknown>(),
    [uploading, setUploading] = useState(false);
  async function choosePhoto() {
    if (uploading) return;
    setPhotoError(null);
    setUploading(true);
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted)
        throw new Error("Allow photo access to choose your profile image.");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled) {
        const photo = result.assets[0];
        await uploadAvatar({
          uri: photo.uri,
          name: photo.fileName || "profile.jpg",
          mimeType: photo.mimeType || "image/jpeg",
          size: photo.fileSize,
          file: photo.file,
        });
        await refreshProfile();
      }
    } catch (e) {
      setPhotoError(e);
    } finally {
      setUploading(false);
    }
  }
  return (
    <Screen title="Profile" back>
      <T muted>App version {appConfig.expo.version}</T>
      <Card style={{ alignItems: "center", gap: 12, paddingVertical: 28 }}>
        <UserAvatar profile={profile} size={86} />
        <ErrorMessage error={photoError} />
        <Button
          title={
            profile?.avatar_path ? "Change profile photo" : "Add profile photo"
          }
          secondary
          icon="camera"
          loading={uploading}
          onPress={choosePhoto}
        />
        <T style={{ fontSize: 22, fontWeight: "700" }}>{profile?.name}</T>
        <T muted>{organization.data?.name || "Organization"}</T>
        <Badge value={profile?.role || "Viewer"} />
        <T muted>{profile?.email}</T>
      </Card>
      <Card>
        {[
          "Work Orders",
          "Organization",
          "Sites",
          "Notifications",
          "Language",
          "Change Password",
          "Help & Support",
        ].map((label, i) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() =>
              label === "Change Password"
                ? router.push("/forgot-password?mode=change")
                : router.push(
                    (
                      {
                        "Work Orders": "/(tabs)/work-orders",
                        Organization: "/settings/organization",
                        Sites: "/settings/sites",
                        Notifications: "/settings/notifications",
                        Language: "/settings/language",
                        "Help & Support": "/settings/help",
                      } as const
                    )[
                      label as
                        | "Work Orders"
                        | "Organization"
                        | "Sites"
                        | "Notifications"
                        | "Language"
                        | "Help & Support"
                    ],
                  )
            }
            style={[
              styles.between,
              {
                paddingVertical: 17,
                borderBottomWidth: i < 6 ? 1 : 0,
                borderBottomColor: "#E5EAF1",
              },
            ]}
          >
            <View style={styles.row}>
              <Icon
                name={
                  (
                    [
                      "clipboard",
                      "briefcase",
                      "map-pin",
                      "bell",
                      "globe",
                      "lock",
                      "help-circle",
                    ] as const
                  )[i]
                }
                size={18}
              />
              <T>{label}</T>
            </View>
            <Icon name="chevron-right" size={16} />
          </Pressable>
        ))}
      </Card>
      <ErrorMessage error={error} />
      <Button
        title="Logout"
        secondary
        icon="log-out"
        onPress={async () => {
          try {
            await logout();
            router.replace("/login");
          } catch (e) {
            setError(e);
          }
        }}
      />
    </Screen>
  );
}
