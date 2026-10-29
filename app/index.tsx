import React, { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { State } from "../components/ui";
import { WELCOME_SEEN_KEY } from "../constants/onboarding";
import { useApp } from "../providers/AppProvider";

type Destination = "/welcome" | "/login" | "/(tabs)/dashboard";

export default function Index() {
  const { profile, loading } = useApp();
  const [destination, setDestination] = useState<Destination | null>(null);

  useEffect(() => {
    if (loading) return;
    if (profile) {
      setDestination("/(tabs)/dashboard");
      return;
    }

    let active = true;
    AsyncStorage.getItem(WELCOME_SEEN_KEY)
      .then((seen) => {
        if (active) setDestination(seen ? "/login" : "/welcome");
      })
      .catch(() => {
        if (active) setDestination("/welcome");
      });

    return () => {
      active = false;
    };
  }, [loading, profile]);

  return destination ? <Redirect href={destination} /> : <State loading />;
}
