// Default addresses a DAM configuration may override besides its five (`CommonAdminCoreDamConfig`).
// A separate module, so the API modules and the options can both read them without loading each other.

export const DAM_END_POINT_CONFIGURATION = '/adm/v1/configuration'
export const DAM_END_POINT_PUB_CONFIGURATION = '/pub/v1/configuration'
export const DAM_END_POINT_ASSET_LICENCE = '/adm/v1/asset-licence'
export const DAM_END_POINT_ASSET_CUSTOM_FORM = '/adm/v1/asset-custom-form'
export const DAM_END_POINT_USER = '/adm/v1/user'
export const DAM_END_POINT_PODCAST = '/adm/v1/podcast'
export const DAM_END_POINT_CMS_ASSET = '/adm/v1/cms/asset'
