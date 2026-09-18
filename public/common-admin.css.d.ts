// Type declaration for the `./styles` subpath export, which resolves to a bare .css file.
// TypeScript 6 enables `noUncheckedSideEffectImports`, so `import '@anzusystems/common-admin/styles'`
// needs the export to carry a `types` condition — without it consumers get TS2882. Vuetify ships
// the same thing for `vuetify/styles`. A module with no exports is deliberate: there is nothing to
// import from a stylesheet, so a named import from it stays an error.
export {}
