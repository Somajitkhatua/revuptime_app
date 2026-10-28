import { Redirect } from "expo-router";
import { useApp } from "../providers/AppProvider";
export default function Index() {
  const { profile } = useApp();
  return <Redirect href={profile ? "/(tabs)/dashboard" : "/login"} />;
}
