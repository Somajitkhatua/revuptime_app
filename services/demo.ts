import AsyncStorage from "@react-native-async-storage/async-storage";
import { createSeed } from "../data/seed";
import { DemoState } from "../types/models";
let state: DemoState | null = null;
let queue: Promise<unknown> = Promise.resolve();
const key = "revuptime.demo.v1";
export async function demo(): Promise<DemoState> {
  if (state) return state;
  const stored = await AsyncStorage.getItem(key);
  state = stored ? JSON.parse(stored) : createSeed();
  return state!;
}
export async function mutateDemo<T>(fn: (s: DemoState) => T): Promise<T> {
  const task = queue.then(async () => {
    const s = await demo();
    const next = JSON.parse(JSON.stringify(s)) as DemoState;
    const result = fn(next);
    await AsyncStorage.setItem(key, JSON.stringify(next));
    state = next;
    return result;
  });
  queue = task.catch(() => undefined);
  return task;
}
export const uuid = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
