import { canEditMaintenance } from "../../utils/permissions";
import React, { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Screen,
  Section,
  Button,
  Chips,
  DocumentCard,
  State,
  styles,
  Field,
  T,
} from "../../components/ui";
import { useDocuments, useAsset } from "../../hooks/queries";
import { useApp } from "../../providers/AppProvider";
import WorkspaceSelect from "../../components/WorkspaceSelect";
import { documentMatchesCategory } from "../../utils/documents";
export default function Documents() {
  const { profile } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>(),
    q = useDocuments(id || ""),
    a = useAsset(id),
    [filter, setFilter] = useState("All"),
    [search, setSearch] = useState("");
  const rows = (q.data || []).filter(
    (d) =>
      documentMatchesCategory(d.type, filter) &&
      `${d.title} ${d.filename || ""} ${d.manufacturer} ${d.model}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  return (
    <Screen
      title="Documents"
      subtitle={a.data?.name}
      back
      actions={
        canEditMaintenance(profile) && (
          <Button
            title="Upload"
            icon="plus"
            onPress={() =>
              router.push(
                id ? `/document/upload?assetId=${id}` : "/document/upload",
              )
            }
          />
        )
      }
      onRefresh={() => q.refetch()}
      refreshing={q.isRefetching}
    >
      <WorkspaceSelect onChanged={() => router.replace("/asset/documents")} />
      <T muted>
        {id
          ? "Machine documents and shared manuals from this workspace and plant."
          : "All documents in the selected workspace, including uploads from the web app."}
      </T>
      {!!id && (
        <Button
          title="View all workspace documents"
          secondary
          onPress={() => router.push("/asset/documents")}
        />
      )}
      <Field
        label="Search documents"
        value={search}
        onChange={setSearch}
        placeholder="Filename, title, manufacturer or model"
      />
      <Chips
        values={["All", "Manuals", "Datasheets", "SOP"]}
        value={filter}
        onChange={setFilter}
      />
      <State
        loading={q.isLoading}
        error={q.error}
        retry={() => q.refetch()}
        empty={
          !q.isLoading && !q.error && !rows.length
            ? "No matching documents. Check the selected workspace, category and search."
            : undefined
        }
      />
      {rows.map((d) => (
        <DocumentCard key={d.id} document={d} />
      ))}
    </Screen>
  );
}
