import type {
  DamExtSystemConfig,
  DamPrvConfig,
  DamPubConfig,
} from "@/types/coreDam/DamConfig";
import type { AxiosInstance } from "axios";
import type { IntegerId } from "@/types/common";
import { SYSTEM_CORE_DAM } from "@/components/damImage/uploadQueue/api/damAssetApi";
import { useApiRequest } from "@/labs/api/useApiRequest";

const END_POINT = "/adm/v1/configuration";
const PUB_END_POINT_PREFIX = "/pub";
const PUB_END_POINT = PUB_END_POINT_PREFIX + "/v1/configuration";
const ENTITY = "settings";

export const fetchPubConfiguration = (damClient: () => AxiosInstance) => {
  const { executeRequest } = useApiRequest<DamPubConfig, null>({
    client: damClient,
    method: "GET",
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: PUB_END_POINT,
  });

  return executeRequest();
};

export const fetchConfiguration = (damClient: () => AxiosInstance) => {
  const { executeRequest } = useApiRequest<DamPrvConfig, null>({
    client: damClient,
    method: "GET",
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT,
  });

  return executeRequest();
};

// The id goes through `urlParams`, not into the string: `anzu/url-params-match-template` only
// reads static templates, so a concatenated url is a url the rule cannot check.
export const fetchExtSystemConfiguration = (
  extSystem: IntegerId,
  damClient: () => AxiosInstance,
) => {
  const { executeRequest } = useApiRequest<DamExtSystemConfig, null>({
    client: damClient,
    method: "GET",
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT + "/ext-system/:extSystem",
  });

  return executeRequest({ urlParams: { extSystem } });
};
