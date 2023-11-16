export const damFileTypeFix = (file: File | null | undefined) => {
  if (!file) return ''
  if (file.type && file.type.length > 0) {
    return file.type
  }
  const extension = file.name.split('.').pop()?.toLowerCase()
  switch (extension) {
    case 'mov':
      return 'video/quicktime'
    default:
      return ''
  }
}
