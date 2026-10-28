import React from "react";
import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { AssetAlert, WorkOrder } from "../types/models";
import { StatusTag, o } from "./OperationsUI";
import { ago, isOverdue } from "../utils/operations";
import { Icon } from "./ui";
export function OperationalAlertCard({
  alert,
  machine,
}: {
  alert: AssetAlert;
  machine?: string;
}) {
  const critical = ["Critical", "High"].includes(alert.severity),
    tint = critical
      ? "#DC3545"
      : alert.severity === "Warning"
        ? "#D78200"
        : "#687D95";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Review alert: ${alert.title}`}
      onPress={() => router.push(`/alert/${alert.id}`)}
      style={[
        o.card,
        { borderColor: tint + "55", backgroundColor: tint + "06" },
      ]}
    >
      <View style={o.between}>
        <StatusTag label={alert.severity} color={tint} />
        <Text style={o.caption}>{ago(alert.detected_at)}</Text>
      </View>
      <View style={o.between}>
        <Text style={[o.title, { flex: 1 }]}>
          {machine || (alert.gateway_id ? "Gateway alert" : "Workspace alert")}
        </Text>
        <Icon name="chevron-right" size={18} />
      </View>
      <Text style={o.text}>{alert.title}</Text>
      {(Number.isFinite(alert.value) || Number.isFinite(alert.threshold)) && (
        <Text style={o.caption}>
          {Number.isFinite(alert.value)
            ? `${alert.value} ${alert.unit}`
            : "Value unavailable"}
          {Number.isFinite(alert.threshold)
            ? ` · Limit ${alert.threshold} ${alert.unit}`
            : ""}
        </Text>
      )}
      {alert.status !== "Open" && (
        <StatusTag label={alert.status} color="#687D95" />
      )}
      {critical && alert.status === "Open" && (
        <View
          style={{
            padding: 10,
            borderRadius: 9,
            backgroundColor: "#0085FF",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "white", fontWeight: "700", fontSize: 13 }}>
            Review alert
          </Text>
        </View>
      )}
    </Pressable>
  );
}
export function OperationalWorkCard({
  order,
  machine,
  assignee,
}: {
  order: WorkOrder;
  machine?: string;
  assignee?: string;
}) {
  const completed = order.tasks?.filter((t) => t.completed).length || 0,
    total = order.tasks?.length || 0;
  const overdue = isOverdue(order);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open work order: ${order.title}`}
      onPress={() => router.push(`/work-order/${order.id}`)}
      style={o.card}
    >
      <View style={[o.between, { flexWrap: "wrap" }]}>
        <Text style={o.caption}>{order.number || "Work order"}</Text>
        <View style={o.row}>
          <StatusTag
            label={order.priority}
            color={order.priority === "High" ? "#DC3545" : "#687D95"}
          />
          <StatusTag
            label={order.status}
            status={
              order.status === "Completed"
                ? "good"
                : order.status === "In Progress"
                  ? "watch"
                  : "no_data"
            }
          />
        </View>
      </View>
      <Text style={o.title}>{order.title}</Text>
      <Text style={o.text}>{machine || "Workspace maintenance"}</Text>
      {!!total && (
        <>
          <View
            style={{
              height: 6,
              borderRadius: 6,
              backgroundColor: "#EAF0F7",
              overflow: "hidden",
            }}
          >
            <View
              style={{
                height: 6,
                width: `${(completed / total) * 100}%`,
                backgroundColor: "#0085FF",
                borderRadius: 6,
              }}
            />
          </View>
          <Text style={o.caption}>
            {completed} of {total} tasks
          </Text>
        </>
      )}
      <View style={o.row}>
        <Icon
          name="calendar"
          size={14}
          color={overdue ? "#DC3545" : "#687D95"}
        />
        <Text
          style={[
            o.caption,
            { color: overdue ? "#DC3545" : "#687D95", flex: 1 },
          ]}
        >
          {overdue ? "Overdue · " : "Due "}
          {order.due_date || "date not set"}
          {assignee ? ` · ${assignee}` : ""}
        </Text>
        <Icon name="chevron-right" size={16} />
      </View>
    </Pressable>
  );
}
