import type { DamExtSystem } from "@/components/damImage/uploadQueue/composables/DamExtSystem";
import type { AxiosInstance } from "axios";
import { SYSTEM_CORE_DAM } from "@/components/damImage/uploadQueue/api/damAssetApi";
import type { IntegerId } from "@/types/common";
import { useApiFetchList } from "@/labs/api/useApiFetchList";
import { useApiFetchByIds } from "@/labs/api/useApiFetchByIds";
// eslint-disable-next-line anzu/no-deprecated-imports
import { apiFetchList } from "@/services/api/apiFetchList";
// eslint-disable-next-line anzu/no-deprecated-imports
import type { FilterBag } from "@/types/Filter";
import type { Pagination } from "@/types/Pagination";

const END_POINT = "/adm/v1/ext-system";
export const ENTITY = "extSystem";

export const fetchDamExtSystemListByIds = (
  client: () => AxiosInstance,
  ids: IntegerId[],
) => {
  const { executeFetch } = useApiFetchByIds<DamExtSystem[]>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT,
  });

  return executeFetch(ids);
};

export const useFetchDamExtSystemList = (client: () => AxiosInstance) =>
  useApiFetchList<DamExtSystem[]>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT,
  });

/**
 * @deprecated
 */
export const fetchDamExtSystemList = (
  client: () => AxiosInstance,
  pagination: Pagination,
  filterBag: FilterBag,
) =>
  apiFetchList<DamExtSystem[]>(
    client,
    END_POINT,
    {},
    pagination,
    filterBag,
    SYSTEM_CORE_DAM,
    ENTITY,
  );
