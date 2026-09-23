# Other

- always use `A` prefix for exported components (exceptions: `Acl`, DAM components with `Dam` prefix, `ImageMassOperations`, `FiltersSelected`)
- in utils, always use prefix for exports like `object`, `array`, `string`, `date`, `dateTime`, etc. (exceptions: type guards `is*` like `isDefined`, `isString`, and `cloneDeep`, `prettyBytes`, `prettyDuration`, `generateUUIDv4`)
