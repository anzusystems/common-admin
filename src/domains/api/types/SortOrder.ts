export const SortOrder = {
  Asc: 'asc',
  Desc: 'desc',
} as const
export type SortOrderType = (typeof SortOrder)[keyof typeof SortOrder]
