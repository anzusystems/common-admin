import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import type { AssetFileImage } from "@/types/coreDam/AssetFile";
import type { RegionOfInterest } from "@/types/coreDam/Roi";
import { isNull } from "@/utils/common";

/**
 * A DAM client with no DAM behind it.
 *
 * `DamAssetImageRoiSelect` talks to the real API layer, so the playground gives it an axios instance
 * whose adapter answers from memory instead of the network. That makes the region-of-interest
 * editor — the one place the cropper actually ships — clickable without a backend, and the saved
 * regions observable: every PUT is recorded in `savedRegions` for the view to show.
 */

export interface SavedRegion {
  at: Date;
  url: string;
  region: RegionOfInterest;
}

export const savedRegions: SavedRegion[] = [];

let imageFile: AssetFileImage | null = null;

export const setMockImageFile = (file: AssetFileImage) => {
  imageFile = file;
};

const respond = (
  config: InternalAxiosRequestConfig,
  data: unknown,
): AxiosResponse => ({
  data,
  status: 200,
  statusText: "OK",
  headers: {},
  config,
});

let mainInstance: AxiosInstance | null = null;

export const damRoiClient = function (): AxiosInstance {
  if (isNull(mainInstance)) {
    mainInstance = axios.create({
      baseURL: "http://dam.mock",
      adapter: async (config) => {
        const url = config.url ?? "";
        if (config.method === "put" && url.includes("/roi/")) {
          const region = JSON.parse(String(config.data)) as RegionOfInterest;
          savedRegions.unshift({ at: new Date(), url, region });
          return respond(config, region);
        }
        if (config.method === "get" && url.includes("/image/")) {
          return respond(config, imageFile);
        }
        return respond(config, {});
      },
    });
  }

  return mainInstance;
};
