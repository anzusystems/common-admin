// Apart from the api modules on purpose: nearly every DAM module needs these, and importing them from
// damAssetApi closed an import cycle through the DAM config.
export const SYSTEM_CORE_DAM = 'coreDam'
export const SYSTEM_DAM = 'dam'
