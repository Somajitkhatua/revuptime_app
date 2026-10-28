import React, { useState } from "react";
import { userError } from "../utils/userError";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { usePathname, router } from "expo-router";
import Svg, {
  Circle,
  Path,
  Defs,
  LinearGradient,
  Stop,
  Rect,
} from "react-native-svg";
import { colors as c } from "../constants/colors";
import { Asset, AssetAlert, WorkOrder, AssetDocument } from "../types/models";
import { useApp } from "../providers/AppProvider";
import { isDemo } from "../services/supabase";
import {
  MonitoringAlertRow,
  MonitoringWorkRow,
  MonitoringDocumentRow,
} from "./MonitoringRows";
import IndustrialPage from "./IndustrialPage";
import MainNavigation from "./MainNavigation";
export const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    fontSize: 19,
    fontWeight: "700",
    color: c.navy,
    letterSpacing: -0.6,
  },
  text: { fontSize: 14, color: c.navy, lineHeight: 22 },
  muted: { fontSize: 13, color: c.muted, lineHeight: 21 },
  caption: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.3,
    color: c.muted,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: c.border,
    shadowColor: "#16304A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.025,
    shadowRadius: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: "white",
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 9,
    fontSize: 14,
    color: c.navy,
    minHeight: 42,
  },
  divider: { height: 1, backgroundColor: c.border, marginVertical: 16 },
  section: { gap: 14 },
  pill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  button: {
    minHeight: 48,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    flexDirection: "row",
    gap: 9,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: "#EDF5FD",
    alignItems: "center",
    justifyContent: "center",
  },
});
export type IconName = React.ComponentProps<typeof Feather>["name"];
export function Icon({
  name,
  size = 20,
  color = c.muted,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <Feather name={name} size={size} color={color} />;
}
export function T({
  children,
  muted = false,
  style,
}: {
  children: React.ReactNode;
  muted?: boolean;
  style?: any;
}) {
  return (
    <Text style={[muted ? styles.muted : styles.text, style]}>{children}</Text>
  );
}
export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
}) {
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, style, pressed && { opacity: 0.8 }]}
    >
      {children}
    </Pressable>
  ) : (
    <View style={[styles.card, style]}>{children}</View>
  );
}
export function Button({
  title,
  onPress,
  secondary = false,
  danger = false,
  loading = false,
  disabled = false,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  danger?: boolean;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: any;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: secondary ? "#EDF5FD" : danger ? c.red : c.blue,
          opacity: disabled || loading ? 0.5 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? c.blue : "white"} />
      ) : (
        <>
          {icon && (
            <Icon name={icon} size={17} color={secondary ? c.blue : "white"} />
          )}
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: secondary ? c.blue : "white",
            }}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}
export const tone = (value: string) =>
  ["Critical", "High"].includes(value)
    ? c.red
    : ["Warning", "Medium"].includes(value)
      ? c.amber
      : ["Healthy", "Completed", "Resolved", "Ready for AI"].includes(value)
        ? c.green
        : c.blue;
export function Badge({ value }: { value: string }) {
  const color = tone(value);
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: color + "13", alignSelf: "flex-start" },
      ]}
    >
      <Text style={{ color, fontSize: 11, fontWeight: "700" }}>{value}</Text>
    </View>
  );
}
export function Section({
  title,
  link,
  onPress,
  kicker,
}: {
  title: string;
  link?: string;
  onPress?: () => void;
  kicker?: string;
}) {
  return (
    <View style={styles.between}>
      <View>
        {kicker && (
          <Text style={[styles.caption, { marginBottom: 5 }]}>{kicker}</Text>
        )}
        <Text
          style={{
            fontSize: 18,
            fontWeight: "700",
            color: c.navy,
            letterSpacing: -0.3,
          }}
        >
          {title}
        </Text>
      </View>
      {link && (
        <Pressable onPress={onPress} accessibilityRole="button">
          <Text style={{ color: c.blue, fontWeight: "600", fontSize: 12 }}>
            {link} →
          </Text>
        </Pressable>
      )}
    </View>
  );
}
export function AppHeader({
  title,
  subtitle,
  back = false,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
}) {
  const { width } = useWindowDimensions();
  return (
    <View
      style={{
        backgroundColor: c.navy,
        paddingTop: Platform.OS === "web" ? 0 : 8,
      }}
    >
      <View
        style={{
          paddingHorizontal: width > 700 ? 32 : 22,
          paddingVertical: 20,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          maxWidth: 1220,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <View style={styles.row}>
          {back ? (
            <Pressable
              accessibilityLabel="Go back"
              onPress={() =>
                router.canGoBack()
                  ? router.back()
                  : router.replace("/(tabs)/dashboard")
              }
              style={{ padding: 5 }}
            >
              <Icon name="arrow-left" color="white" />
            </Pressable>
          ) : (
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: c.blue,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="activity" color="white" size={24} />
            </View>
          )}
          <View>
            <Text
              style={{
                color: "white",
                fontSize: back ? 19 : 23,
                fontWeight: "700",
                letterSpacing: -0.7,
              }}
            >
              {title}
            </Text>
            {!!subtitle && (
              <Text
                style={{
                  color: "#8DA0BC",
                  fontSize: 10,
                  letterSpacing: back ? 0 : 1.4,
                  marginTop: 3,
                }}
              >
                {subtitle}
              </Text>
            )}
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
          <Pressable
            accessibilityLabel="Notifications"
            onPress={() => router.push("/notifications")}
          >
            <Icon name="bell" color="#CED8E8" />
            <View
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                width: 6,
                height: 6,
                backgroundColor: c.blue,
                borderRadius: 4,
              }}
            />
          </Pressable>
          <Pressable
            accessibilityLabel="Profile"
            onPress={() => router.push("/profile")}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: "#2A3C59",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: "#52617A",
            }}
          >
            <Text style={{ color: "white", fontSize: 11, fontWeight: "700" }}>
              RK
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
export function Screen({
  children,
  title,
  subtitle,
  back,
  refreshing,
  onRefresh,
  actions,
  footer,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  back?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const pathname = usePathname();
  const main = [
    "/dashboard",
    "/assets",
    "/devices",
    "/alerts",
    "/work-orders",
    "/ai",
  ].includes(pathname);
  const active = pathname.startsWith("/devices")
    ? "devices"
    : pathname.startsWith("/alert")
      ? "alerts"
      : pathname.startsWith("/work-order")
        ? "work-orders"
        : "assets";
  return (
    <View style={{ flex: 1 }}>
      <IndustrialPage
        title={title || "RevUpTime"}
        subtitle={subtitle}
        back={back}
        refreshing={refreshing}
        onRefresh={onRefresh}
        actions={actions}
        footer={footer}
      >
        {children}
      </IndustrialPage>
      {!main &&
        back &&
        ![
          "/forgot-password",
          "/register",
          "/verify-email",
          "/auth/confirm",
        ].includes(pathname) && <MainNavigation active={active} />}
    </View>
  );
}
export function State({
  loading,
  error,
  empty,
  retry,
}: {
  loading?: boolean;
  error?: unknown;
  empty?: string;
  retry?: () => void;
}) {
  if (loading)
    return (
      <View style={{ padding: 45, alignItems: "center", gap: 12 }}>
        <ActivityIndicator color={c.blue} />
        <T muted>Loading plant data…</T>
      </View>
    );
  if (error)
    return (
      <Card>
        <Icon name="alert-circle" color={c.red} />
        <T style={{ marginTop: 10 }}>
          {userError(error, "Unable to load data. Please try again.")}
        </T>
        {retry && (
          <Button
            title="Try again"
            onPress={retry}
            secondary
            style={{ marginTop: 16 }}
          />
        )}
      </Card>
    );
  if (empty)
    return (
      <Card style={{ alignItems: "center", paddingVertical: 32, gap: 10 }}>
        <Icon name="inbox" size={30} />
        <T muted>{empty}</T>
      </Card>
    );
  return null;
}
export function Search({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <View style={[styles.row, styles.input, { paddingVertical: 0 }]}>
      <Icon name="search" size={18} />
      <TextInput
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        value={value}
        onChangeText={onChange}
        style={
          {
            flex: 1,
            color: c.navy,
            fontSize: 14,
            paddingVertical: 14,
            outlineStyle: "none",
          } as any
        }
      />
      {!!value && (
        <Pressable
          onPress={() => onChange("")}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <Icon name="x" size={16} />
        </Pressable>
      )}
    </View>
  );
}
export function Chips({
  values,
  value,
  onChange,
}: {
  values: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      contentContainerStyle={{ gap: 6 }}
    >
      {values.map((v) => (
        <Pressable
          key={v}
          onPress={() => onChange(v)}
          accessibilityRole="button"
          accessibilityState={{ selected: v === value }}
          style={{
            paddingHorizontal: 13,
            paddingVertical: 8,
            borderRadius: 9,
            backgroundColor: value === v ? c.blue : "#EEF3F9",
            borderWidth: 1,
            borderColor: value === v ? c.blue : "#EEF3F9",
          }}
        >
          <Text
            style={{
              color: value === v ? "white" : c.muted,
              fontSize: 12,
              fontWeight: "600",
            }}
          >
            {v}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
export function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  numeric = false,
  secure = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  numeric?: boolean;
  secure?: boolean;
}) {
  return (
    <View style={{ gap: 8 }}>
      <T style={{ fontSize: 12, fontWeight: "600" }}>{label}</T>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        multiline={multiline}
        keyboardType={numeric ? "decimal-pad" : "default"}
        secureTextEntry={secure}
        autoCapitalize="none"
        style={[
          styles.input,
          multiline && { minHeight: 65, textAlignVertical: "top" },
        ]}
      />
    </View>
  );
}
export function Select({
  label,
  value,
  options,
  onChange,
  compact = false,
  accessibilityLabel,
}: {
  label?: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (id: string) => void;
  compact?: boolean;
  accessibilityLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 7 }}>
      {label && <T style={{ fontSize: 12, fontWeight: "600" }}>{label}</T>}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || label || "Select plant"}
        onPress={() => setOpen(true)}
        style={[
          styles.input,
          styles.between,
          compact && {
            minHeight: 35,
            paddingVertical: 8,
            paddingHorizontal: 10,
            backgroundColor: "#EFF3F8",
            borderWidth: 0,
            borderRadius: 9,
            gap: 8,
          },
        ]}
      >
        <View style={styles.row}>
          {!compact && (
            <Icon
              name={label === "Asset" ? "box" : "map-pin"}
              size={16}
              color={c.blue}
            />
          )}
          <Text style={{ fontSize: 13, fontWeight: "600", color: c.navy }}>
            {options.find((o) => o.value === value)?.label || "Select…"}
          </Text>
        </View>
        <Icon name="chevron-down" size={16} />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "#0F1E3A70",
            justifyContent: "center",
            padding: 24,
          }}
          onPress={() => setOpen(false)}
        >
          <View
            style={[
              styles.card,
              {
                maxWidth: 450,
                width: "100%",
                alignSelf: "center",
                maxHeight: "80%",
              },
            ]}
          >
            <Section title={label || accessibilityLabel || "Select plant"} />
            <ScrollView style={{ marginTop: 16 }}>
              {options.map((o) => (
                <Pressable
                  key={o.value}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  style={[
                    styles.between,
                    {
                      paddingVertical: 17,
                      borderBottomWidth: 1,
                      borderBottomColor: c.border,
                    },
                  ]}
                >
                  <T>{o.label}</T>
                  {value === o.value && <Icon name="check" color={c.blue} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
export function HealthScore({
  score,
  health,
}: {
  score: number;
  health: string;
}) {
  return (
    <View style={{ alignItems: "flex-end", gap: 7 }}>
      <Text
        style={{
          fontSize: 25,
          color: tone(health),
          fontWeight: "700",
          letterSpacing: -1,
        }}
      >
        {score}
        <Text style={{ fontSize: 12 }}>%</Text>
      </Text>
      <View
        style={{
          width: 54,
          height: 4,
          borderRadius: 3,
          backgroundColor: "#E8EDF3",
        }}
      >
        <View
          style={{
            width: `${score}%`,
            height: 4,
            borderRadius: 3,
            backgroundColor: tone(health),
          }}
        />
      </View>
    </View>
  );
}
export function MachineArt({
  type = "Motor",
  large = false,
}: {
  type?: string;
  large?: boolean;
}) {
  return (
    <View
      style={{
        width: large ? "100%" : 56,
        height: large ? 155 : 56,
        backgroundColor: large ? "#EEF3F7" : "#F0F4F8",
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {large ? (
        <Svg width="240" height="140" viewBox="0 0 240 140">
          <Defs>
            <LinearGradient id="motor" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#8EA2B5" />
              <Stop offset=".5" stopColor="#BAC8D4" />
              <Stop offset="1" stopColor="#6C839A" />
            </LinearGradient>
          </Defs>
          <Rect x="42" y="105" width="155" height="10" rx="4" fill="#41566D" />
          <Rect x="64" y="90" width="20" height="20" fill="#536B82" />
          <Rect x="151" y="90" width="20" height="20" fill="#536B82" />
          <Rect
            x="60"
            y="36"
            width="123"
            height="64"
            rx="16"
            fill="url(#motor)"
          />
          <Rect x="47" y="45" width="24" height="48" rx="9" fill="#526A80" />
          {Array.from({ length: 12 }, (_, i) => (
            <Path
              key={i}
              d={`M ${77 + i * 8} 43 L ${77 + i * 8} 94`}
              stroke="#527089"
              strokeWidth="3"
            />
          ))}
          <Rect x="178" y="53" width="20" height="30" rx="6" fill="#526A80" />
          <Rect x="195" y="64" width="27" height="8" rx="2" fill="#A4B5C3" />
          <Rect x="92" y="20" width="49" height="22" rx="4" fill="#526A80" />
          <Rect x="99" y="24" width="35" height="12" rx="2" fill="#859BAE" />
        </Svg>
      ) : (
        <Icon
          name={
            type === "Fan"
              ? "wind"
              : type === "Pump"
                ? "droplet"
                : type === "Gearbox"
                  ? "settings"
                  : "cpu"
          }
          size={26}
          color="#587289"
        />
      )}
    </View>
  );
}
export function AssetCard({ asset }: { asset: Asset }) {
  return (
    <Card
      onPress={() => router.push(`/asset/${asset.id}`)}
      style={{ padding: 17 }}
    >
      <View style={styles.row}>
        <MachineArt type={asset.type} />
        <View style={{ flex: 1, gap: 3 }}>
          <T style={{ fontWeight: "700" }}>{asset.name}</T>
          <T muted style={{ fontSize: 11 }}>
            {asset.description}
          </T>
          <View style={[styles.row, { gap: 5 }]}>
            <View
              style={{
                height: 5,
                width: 5,
                borderRadius: 3,
                backgroundColor: tone(asset.health),
              }}
            />
            <T style={{ fontSize: 10, color: tone(asset.health) }}>
              {asset.health}
            </T>
          </View>
        </View>
        <HealthScore score={asset.health_score} health={asset.health} />
        <Icon name="chevron-right" size={16} />
      </View>
    </Card>
  );
}
export function AlertCard(props: { alert: AssetAlert; asset?: Asset }) {
  return <MonitoringAlertRow {...props} />;
}
export function WorkOrderCard(props: {
  order: WorkOrder;
  asset?: Asset;
  compact?: boolean;
}) {
  return <MonitoringWorkRow {...props} />;
}
export function DocumentCard(props: { document: AssetDocument }) {
  return <MonitoringDocumentRow {...props} />;
}
export function SensorMetric({
  label,
  value,
  unit,
  abnormal = false,
  icon = "activity",
}: {
  label: string;
  value: number | string;
  unit?: string;
  abnormal?: boolean;
  icon?: IconName;
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 90,
        padding: 10,
        backgroundColor: abnormal ? "#FFF5F5" : "#F6F8FB",
        borderRadius: 12,
        gap: 10,
      }}
    >
      <View style={styles.between}>
        <T muted style={{ fontSize: 11 }}>
          {label}
        </T>
        <Icon name={icon} size={14} color={abnormal ? c.red : c.muted} />
      </View>
      <Text
        style={{
          fontSize: 18,
          fontWeight: "700",
          color: abnormal ? c.red : c.navy,
        }}
      >
        {value}
        <Text style={{ fontSize: 11, fontWeight: "400", color: c.muted }}>
          {" "}
          {unit}
        </Text>
      </Text>
    </View>
  );
}
export function PlantHealthGauge({ score }: { score: number }) {
  const dash = 2 * Math.PI * 72;
  return (
    <View
      style={{ alignItems: "center", justifyContent: "center", height: 185 }}
    >
      <Svg width={190} height={190} viewBox="0 0 190 190">
        <Circle
          cx="95"
          cy="95"
          r="72"
          fill="none"
          stroke="#EAF0F5"
          strokeWidth="13"
        />
        <Circle
          cx="95"
          cy="95"
          r="72"
          fill="none"
          stroke={score >= 80 ? c.green : score >= 60 ? c.amber : c.red}
          strokeWidth="13"
          strokeDasharray={`${(dash * score) / 100} ${dash}`}
          strokeLinecap="round"
          transform="rotate(-90 95 95)"
        />
      </Svg>
      <View style={{ position: "absolute", alignItems: "center", gap: 4 }}>
        <Text
          style={{
            fontSize: 46,
            fontWeight: "700",
            color: c.navy,
            letterSpacing: -2,
          }}
        >
          {score}
          <Text style={{ fontSize: 23 }}>%</Text>
        </Text>
        <Text
          style={{
            fontSize: 12,
            fontWeight: "600",
            color: tone(
              score >= 80 ? "Healthy" : score >= 60 ? "Warning" : "Critical",
            ),
          }}
        >
          {score >= 80
            ? "Good Health"
            : score >= 60
              ? "Needs Attention"
              : "Critical Health"}
        </Text>
      </View>
    </View>
  );
}
export function DemoBanner() {
  return isDemo ? (
    <View
      style={[
        styles.row,
        {
          backgroundColor: "#EAF4FF",
          paddingHorizontal: 12,
          paddingVertical: 9,
          borderRadius: 8,
          gap: 7,
        },
      ]}
    >
      <Icon name="info" size={13} color={c.blue} />
      <T style={{ fontSize: 11, color: "#3973A4", flex: 1 }}>
        Demo workspace · sample telemetry · changes saved locally
      </T>
    </View>
  ) : null;
}
export const formatDate = (date: string, time = false) =>
  new Date(date.length === 10 ? date + "T12:00:00" : date).toLocaleString(
    undefined,
    {
      day: "numeric",
      month: "short",
      ...(time
        ? { hour: "2-digit", minute: "2-digit" }
        : {}),
    },
  );
export function ErrorMessage({ error }: { error: unknown }) {
  return error ? (
    <Text accessibilityRole="alert" style={{ color: c.red, fontSize: 12 }}>{userError(error)}</Text>
  ) : null;
}
export function ResponsiveColumns({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  return (
    <View
      style={{
        flexDirection: width > 850 ? "row" : "column",
        gap: 22,
        alignItems: "stretch",
      }}
    >
      {children}
    </View>
  );
}
