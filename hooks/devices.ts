import { useQuery } from "@tanstack/react-query";
import { useOrg } from "./queries";
import { getDevices } from "../services/devices";
export function useDevices() {
  const org = useOrg();
  return useQuery({
    queryKey: ["devices", org],
    queryFn: () => getDevices(org),
    enabled: !!org,
    refetchInterval: 30000,
  });
}
