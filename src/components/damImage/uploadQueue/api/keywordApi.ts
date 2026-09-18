import type { AxiosInstance } from "axios";
import type { DamKeyword } from "@/components/damImage/uploadQueue/keyword/DamKeyword";
import { SYSTEM_CORE_DAM } from "@/components/damImage/uploadQueue/api/damAssetApi";
import { useApiFetchList } from "@/labs/api/useApiFetchList";
import { useApiFetchByIds } from "@/labs/api/useApiFetchByIds";
import { useApiRequest } from "@/labs/api/useApiRequest";
import type { Pagination } from "@/types/Pagination";

const END_POINT = "/adm/v1/keyword";
const END_POINT_LIST = END_POINT + "/ext-system/:extSystemId";
export const ENTITY = "keyword";

export const fetchKeywordListByIds = (
  client: () => AxiosInstance,
  extSystemId: number,
  ids: string[],
) => {
  const { executeFetch } = useApiFetchByIds<DamKeyword[]>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT_LIST + "/search",
    urlParams: { extSystemId },
    isSearchApi: true,
  });

  return executeFetch(ids);
};

export const useFetchKeywordList = (
  client: () => AxiosInstance,
  extSystemId: number,
) =>
  useApiFetchList<DamKeyword[]>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT_LIST,
    urlParams: { extSystemId },
  });

export const createKeyword = (
  client: () => AxiosInstance,
  data: DamKeyword,
) => {
  const { executeRequest } = useApiRequest<DamKeyword, DamKeyword>({
    client,
    method: "POST",
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT,
  });

  return executeRequest({ object: data });
};
