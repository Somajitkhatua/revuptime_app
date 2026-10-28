import React, { useState } from "react";
import { View, Text, Pressable, Linking } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Screen, Search, State, Button, Chips } from "../components/ui";
import { useOrg } from "../hooks/queries";
import { useApp } from "../providers/AppProvider";
import { getInbox, getInboxMessages } from "../services/inbox";
import { o, StatusTag } from "../components/OperationsUI";
import { ago } from "../utils/operations";
export default function Inbox() {
  const org = useOrg(),
    { profile } = useApp(),
    [search, setSearch] = useState(""),
    [active, setActive] = useState(""),
    [filter, setFilter] = useState("All");
  const allowed = [
    "Owner",
    "Admin",
    "Maintenance Manager",
    "Technician",
  ].includes(profile?.role || "");
  const q = useQuery({
    queryKey: ["inbox", org],
    queryFn: () => getInbox(org),
    enabled: !!org && allowed,
    refetchInterval: 15000,
  });
  const messages = useQuery({
    queryKey: ["inbox-messages", org, active],
    queryFn: () => getInboxMessages(org, active),
    enabled: !!active && !!org && allowed,
    refetchInterval: 15000,
  });
  const rows = (q.data || []).filter(
    (c) =>
      (filter !== "Unread" || c.unread_count > 0) &&
      `${c.contact_name} ${c.contact_phone}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <Screen
      title="Inbox"
      back
      onRefresh={() => q.refetch()}
      refreshing={q.isRefetching}
    >
      {!allowed ? (
        <Text style={o.text}>
          Your role does not have access to the workspace Inbox.
        </Text>
      ) : (
        <>
          <Text style={o.caption}>
            Synced WhatsApp conversations. Opening a conversation here does not
            mark it read.
          </Text>
          <Search
            value={search}
            onChange={setSearch}
            placeholder="Search conversations..."
          />
          <Chips
            values={["All", "Unread"]}
            value={filter}
            onChange={setFilter}
          />
          <State
            loading={q.isLoading}
            error={q.error}
            retry={() => q.refetch()}
            empty={
              q.isSuccess && !rows.length
                ? "No conversations match your filters."
                : undefined
            }
          />
          {rows.map((c) => (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              onPress={() => setActive((v) => (v === c.id ? "" : c.id))}
              style={o.card}
            >
              <View style={o.between}>
                <Text style={o.title}>{c.contact_name || c.contact_phone}</Text>
                {c.unread_count > 0 && (
                  <StatusTag
                    label={`${c.unread_count} unread`}
                    status="watch"
                  />
                )}
              </View>
              <Text style={o.text}>
                {c.last_message_preview || "No message preview"}
              </Text>
              <Text style={o.caption}>
                {ago(c.last_message_at)} · {c.mode}
              </Text>
              {active === c.id && (
                <>
                  <State
                    loading={messages.isLoading}
                    error={messages.error}
                    retry={() => messages.refetch()}
                  />
                  {messages.data?.map((m) => (
                    <View
                      key={m.id}
                      style={{
                        backgroundColor:
                          m.direction === "outbound" ? "#EDF6FF" : "#F4F6F9",
                        padding: 12,
                        borderRadius: 10,
                        gap: 4,
                      }}
                    >
                      <Text style={o.text}>
                        {m.body || `[${m.type} message]`}
                      </Text>
                      <Text style={o.caption}>
                        {new Date(m.created_at).toLocaleString()} · {m.status}
                      </Text>
                    </View>
                  ))}
                </>
              )}
            </Pressable>
          ))}
          <Button
            title="Reply and manage in SaaS Inbox"
            secondary
            onPress={() =>
              void Linking.openURL("https://app.revuptime.com/#inbox")
            }
          />
        </>
      )}
    </Screen>
  );
}
