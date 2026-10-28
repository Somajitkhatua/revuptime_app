import { WorkOrder, Completion, WorkStatus } from "../types/models";
import { rows, update } from "./repository";
import { client, isDemo, isCanonical } from "./supabase";
import { mutateDemo, uuid } from "./demo";
import { validDate } from "../utils/validation";
export const getWorkOrders = (org: string, asset?: string) =>
  rows<WorkOrder>(
    "work_orders",
    "workOrders",
    org,
    asset ? { asset_id: asset } : {},
  );
export async function createWorkOrder(
  org: string,
  input: Pick<
    WorkOrder,
    "asset_id" | "title" | "priority" | "assigned_to" | "due_date" | "notes"
  > & { alert_id?: string },
) {
  if (!input.title.trim() || !validDate(input.due_date))
    throw new Error("Enter a title and a valid due date.");
  if (isDemo)
    return mutateDemo((s) => {
      if (
        !s.assets.some(
          (a) => a.id === input.asset_id && a.organization_id === org,
        )
      )
        throw new Error("Asset not found in this organization.");
      const w: WorkOrder = {
        ...input,
        id: uuid(),
        organization_id: org,
        number: `WO-${new Date().getFullYear()}-${String(48 + s.workOrders.length - 2).padStart(4, "0")}`,
        status: "Open",
        created_at: new Date().toISOString(),
        tasks: [
          "Check vibration reading",
          "Inspect lubrication",
          "Check coupling alignment",
          "Record final vibration",
        ].map((title) => ({ id: uuid(), title, completed: false })),
      };
      s.workOrders.unshift(w);
      return w;
    });
  const { data, error } = await client().rpc(
    isCanonical ? "revuptime_mobile_create_work_order" : "create_work_order",
    {
      p_org: org,
      p_input: input,
    },
  );
  if (error) throw error;
  if (isCanonical)
    return (await getWorkOrders(org)).find((w) => w.id === data.id)!;
  return data as WorkOrder;
}
export async function setWorkOrder(
  org: string,
  id: string,
  values: Partial<
    Pick<WorkOrder, "status" | "tasks" | "assigned_to" | "notes">
  >,
) {
  if (values.status === "Completed")
    throw new Error("Use the completion form to close a work order.");
  if (isDemo)
    return mutateDemo((s) => {
      const w = s.workOrders.find(
        (x) => x.id === id && x.organization_id === org,
      );
      if (!w) throw new Error("Work order not found.");
      if (w.status === "Completed")
        throw new Error("Completed work orders cannot be edited.");
      Object.assign(w, values);
      return w;
    });
  if (isCanonical) {
    const { error } = await client().rpc("revuptime_mobile_update_work_order", {
      p_org: org,
      p_id: id,
      p_values: values,
    });
    if (error) throw error;
    return (await getWorkOrders(org)).find((w) => w.id === id)!;
  }
  return update<WorkOrder>("work_orders", org, id, values);
}
export async function completeWorkOrder(
  org: string,
  id: string,
  result: Completion,
) {
  if (
    !result.root_cause.trim() ||
    !result.action_taken.trim() ||
    !Number.isFinite(result.downtime_minutes) ||
    result.downtime_minutes < 0 ||
    !Number.isFinite(result.final_vibration) ||
    result.final_vibration < 0
  )
    throw new Error("Enter a valid repair outcome.");
  if (isDemo)
    return mutateDemo((s) => {
      const w = s.workOrders.find(
        (x) => x.id === id && x.organization_id === org,
      );
      if (!w) throw new Error("Work order not found.");
      if (w.status === "Completed")
        throw new Error("Work order is already completed.");
      if (w.tasks.some((t) => !t.completed))
        throw new Error("Complete every checklist task first.");
      w.status = "Completed";
      w.result = result;
      w.completed_at = new Date().toISOString();
      s.maintenance.unshift({
        id: uuid(),
        organization_id: org,
        asset_id: w.asset_id,
        work_order_id: w.id,
        title: result.action_taken,
        technician: "Rajesh Kumar",
        occurred_at: w.completed_at,
        root_cause: result.root_cause,
        before_vibration:
          s.readings.filter((r) => r.asset_id === w.asset_id).at(-1)?.x_rms ||
          0,
        after_vibration: result.final_vibration,
        result,
      });
      return w;
    });
  const { data, error } = await client().rpc(
    isCanonical
      ? "revuptime_mobile_complete_work_order"
      : "complete_work_order",
    {
      p_org: org,
      p_id: id,
      p_result: result,
    },
  );
  if (error) throw error;
  if (isCanonical) return (await getWorkOrders(org)).find((w) => w.id === id)!;
  return data as WorkOrder;
}
