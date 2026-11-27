// Kept apart from the api modules on purpose. Nearly every DAM module needs these.
// Importing them from damAssetApi created an import cycle through the DAM config.
export const SYSTEM_CORE_DAM = 'coreDam'
export const SYSTEM_DAM = 'dam'
