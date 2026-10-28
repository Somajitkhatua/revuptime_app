import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, isDemo } from "../services/supabase";
import { demoProfile, loadProfile, signOut } from "../services/auth";
import { Profile } from "../types/models";
import { DEMO_SITE } from "../data/seed";
import { getAccountProfile } from "../services/accountProfile";
import {
  profileInWorkspace,
  workspacePreferenceKey,
} from "../services/workspaces";
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, retry: 1 },
    mutations: { retry: 0 },
  },
});
type Context = {
  profile: Profile | null;
  loading: boolean;
  authError: string | null;
  site: string;
  setSite: (id: string) => void;
  enterDemo: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  selectWorkspace: (organization: string) => Promise<void>;
};
const AppContext = createContext<Context>({
  profile: null,
  loading: true,
  authError: null,
  site: "",
  setSite: () => {},
  enterDemo: async () => {},
  logout: async () => {},
  refreshProfile: async () => {},
  selectWorkspace: async () => {},
});
function SessionProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null),
    [loading, setLoading] = useState(true),
    [authError, setError] = useState<string | null>(null),
    [site, setSiteState] = useState(isDemo ? DEMO_SITE : "");
  const qc = useQueryClient();
  const currentProfile = useRef(profile);
  currentProfile.current = profile;
  useEffect(() => {
    let mounted = true;
    let generation = 0;
    const startupDeadline = setTimeout(() => {
      if (mounted && generation === 0) {
        setError(
          "Your account is taking longer to load. Check your connection and sign in again.",
        );
        setLoading(false);
      }
    }, 20000);
    async function boot() {
      const startedAt = generation;
      try {
        if (isDemo) {
          if (await AsyncStorage.getItem("revuptime.demo-session"))
            setProfile(demoProfile);
        } else {
          const remember = await AsyncStorage.getItem("revuptime.remember");
          if (remember === "false") await supabase!.auth.signOut();
          const {
            data: { session },
          } = await supabase!.auth.getSession();
          if (session) {
            const p = await loadProfile(session.user.id);
            if (mounted && generation === startedAt) {
              setProfile(p);
              setError(null);
            }
          }
        }
      } catch (e) {
        if (mounted && generation === startedAt) setError((e as Error).message);
      } finally {
        clearTimeout(startupDeadline);
        if (mounted) setLoading(false);
      }
    }
    boot();
    const sub = supabase?.auth.onAuthStateChange((event, session) => {
      // The Supabase client updates its token itself. Loading a profile here
      // asks for a session again and can recursively refresh short-lived tokens.
      if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") return;
      const startedAt = ++generation;
      if (!session) {
        setProfile(null);
        setSiteState("");
        qc.clear();
        return;
      }
      setTimeout(() => {
        loadProfile(session.user.id)
          .then((p) => {
            if (mounted && generation === startedAt) {
              setProfile(p);
              setError(null);
            }
          })
          .catch((e) => {
            if (mounted && generation === startedAt) setError(e.message);
          });
      }, 0);
    });
    return () => {
      mounted = false;
      clearTimeout(startupDeadline);
      sub?.data.subscription.unsubscribe();
    };
  }, []);
  const setSite = (id: string) => setSiteState(id);
  const enterDemo = async () => {
    if (!isDemo) return;
    await AsyncStorage.setItem("revuptime.demo-session", "true");
    setError(null);
    setProfile(demoProfile);
  };
  const logout = async () => {
    await signOut();
    setProfile(null);
    setSiteState(isDemo ? DEMO_SITE : "");
    qc.clear();
  };
  const refreshProfile = async () => {
    if (profile && !isDemo) {
      const loaded = await loadProfile(profile.id);
      setProfile((current) => (current?.id === loaded.id ? loaded : current));
    }
  };
  const selectWorkspace = async (organization: string) => {
    if (!supabase || !profile || isDemo)
      throw new Error("Sign in to choose a workspace.");
    const user = profile.id;
    const verified = await getAccountProfile(supabase, user);
    const next = await profileInWorkspace(supabase, verified, organization);
    if (currentProfile.current?.id !== user)
      throw new Error("Your session changed. Please sign in again.");
    await AsyncStorage.setItem(workspacePreferenceKey(user), organization);
    if (currentProfile.current?.id !== user) return;
    await qc.cancelQueries();
    qc.clear();
    setSiteState("");
    setProfile((current) =>
      current?.id === user ? { ...current, ...next } : current,
    );
  };
  return (
    <AppContext.Provider
      value={{
        profile,
        loading,
        authError,
        site,
        setSite,
        enterDemo,
        logout,
        refreshProfile,
        selectWorkspace,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>
  );
}
export const useApp = () => useContext(AppContext);
