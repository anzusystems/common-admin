## [1.34.0](https://github.com/anzusystems/common-admin/compare/1.33.0...1.34.0) (unreleased)

### Features
* **chore:** updated dependencies

### BREAKING CHANGES
* **dependencies:** new vue-i18n required version `vue-i18n@9.6.2`
* **removed:** `ACheckboxSimple`, use `VCheckboxBtn`
* **changed:** `useSubjectSelect` function arguments

## [1.33.0](https://github.com/anzusystems/common-admin/compare/1.32.0...1.33.0) (2023-10-27)

### Features
* **chore:** updated dependencies
* **project:** switched to `node@20` and `yarn@4`

### BREAKING CHANGES
* **dependencies:** new required versions:
  * `axios@1.6.0`
  * `vue-i18n@9.6.1`

## [1.32.0](https://github.com/anzusystems/common-admin/compare/1.31.2...1.32.0) (2023-10-25)

### Features
* **chore:** updated dependencies

### BREAKING CHANGES
* **dependencies:** new vuetify required version is `vuetify@3.3.23`

## [1.31.2](https://github.com/anzusystems/common-admin/compare/1.31.1...1.31.2) (2023-10-23)

### Bug Fixes
* fixed datatable fixed actions background color

## [1.31.1](https://github.com/anzusystems/common-admin/compare/1.31.0...1.31.1) (2023-10-19)

### Bug Fixes
* added missing exports for `generateDatatableMinMaxSelectStrategy` and `ACheckboxSimple`

## [1.31.0](https://github.com/anzusystems/common-admin/compare/1.30.0...1.31.0) (2023-10-19)

### Features
* **chore:** updated dependencies
* **components:** added `ASubjectSelect`

## [1.30.0](https://github.com/anzusystems/common-admin/compare/1.29.0...1.30.0) (2023-10-18)

### Features
* **chore:** updated dependencies

### BREAKING CHANGES
* **dependencies:** new vuetify required version is `vuetify@3.3.22`

## [1.29.0](https://github.com/anzusystems/common-admin/compare/1.28.0...1.29.0) (2023-10-15)

### Features
* **chore:** updated dependencies

### BREAKING CHANGES
* **dependencies:** new pinia required version is `pinia@2.1.7`

## [1.28.0](https://github.com/anzusystems/common-admin/compare/1.27.0...1.28.0) (2023-10-11)

### Features
* **chore:** updated dependencies

### BREAKING CHANGES
* **dependencies:** new vuetify required version is `vuetify@3.3.21`

## [1.27.0](https://github.com/anzusystems/common-admin/compare/1.26.0...1.27.0) (2023-10-09)

### Features
* **chore:** updated dependencies
* **utils:** added `stringIsValidEmail` helper function

### BREAKING CHANGES
* **dependencies:** new required versions:
  * `@vueuse/core@10.5.0`
  * `@vueuse/integrations@10.5.0`

## [1.26.0](https://github.com/anzusystems/common-admin/compare/1.25.0...1.26.0) (2023-10-03)

### Features
* **chore:** updated dependencies

### BREAKING CHANGES
* **dependencies:** new vuetify required version is `vuetify@3.3.20`

## [1.25.0](https://github.com/anzusystems/common-admin/compare/1.24.1...1.25.0) (2023-10-02)

### Features
* **chore:** updated dependencies

### BREAKING CHANGES
* **dependencies:** new vue-i18n required version is `vue-i18n@9.5.0`

## [1.24.1](https://github.com/anzusystems/common-admin/compare/1.24.0...1.24.1) (2023-09-27)

### Bug Fixes
* **apiFetchListBatch:** fixed unnecessary 2nd call (totalCount api variant)

## [1.24.0](https://github.com/anzusystems/common-admin/compare/1.23.0...1.24.0) (2023-09-27)

### Features
* **chore:** updated dependencies
* **api:** added `apiFetchListBatch` to batch load all items using search or list api

### BREAKING CHANGES
* **dependencies:** new required versions:
  * `vuetify@3.3.19`
  * `axios@1.5.1`

## [1.23.0](https://github.com/anzusystems/common-admin/compare/1.22.0...1.23.0) (2023-09-25)

### Features
* **types:** added new utility type `Prettify<T>`
* **chore:** updated dependencies

### BREAKING CHANGES
* **dependencies:** new vue-router required version is `vue-router@4.2.5`

## [1.22.0](https://github.com/anzusystems/common-admin/compare/1.21.0...1.22.0) (2023-09-19)

### Features
* **chore:** updated dependencies

### BREAKING CHANGES
* **dependencies:** new required versions:
  * `vuetify@3.3.17`
  * `dayjs@1.11.10`

## [1.21.0](https://github.com/anzusystems/common-admin/compare/1.20.0...1.21.0) (2023-09-18)

### Features
* **chore:** updated dependencies
* **generator:** added `generateUUIDv4` export

## [1.20.0](https://github.com/anzusystems/common-admin/compare/1.19.0...1.20.0) (2023-09-13)

### Features
* **chore:** updated dependencies

### BREAKING CHANGES
* **dependencies:** new vuetify required version is `vuetify@3.3.16`

## [1.19.0](https://github.com/anzusystems/common-admin/compare/1.18.0...1.19.0) (2023-09-12)

### Features
* **chore:** updated dependencies
* **translations**: added czech translations
* **ASortable:** 
  * added prop `addLastButtonT` for possibility to override default translation text for button that adds new item to last position
  * added slot `add-last-activator` for possibility to override button that adds new item to last position

### BREAKING CHANGES
* **dependencies:** new vue-i18n required version is `vue-i18n@9.4.0`

## [1.18.0](https://github.com/anzusystems/common-admin/compare/1.17.0...1.18.0) (2023-09-06)

### Features
* **chore:** updated dependencies

### BREAKING CHANGES
* **ASortable:** prop `keyField` is now by default set to `position` instead of `id`

## [1.17.0](https://github.com/anzusystems/common-admin/compare/1.16.0...1.17.0) (2023-09-05)

### Features
* **chore:** updated dependencies

### BREAKING CHANGES
* **dependencies:** new vue-i18n required version is `vue-i18n@9.3.0`

## [1.16.0](https://github.com/anzusystems/common-admin/compare/1.15.0...1.16.0) (2023-09-04)

### Features
* **chore:** updated dependencies

### BREAKING CHANGES
* **dependencies:** new required versions:
  * `vuetify@3.3.15`
  * `axios@1.5.0`
  * `@vueuse/core@10.4.1`
  * `@vueuse/integrations@10.4.1`

## [1.15.0](https://github.com/anzusystems/common-admin/compare/1.14.1...1.15.0) (2023-08-23)

### Features
* **chore:** updated dependencies

### BREAKING CHANGES
* **dependencies:** new vuetify required version is `vuetify@3.3.14`

## [1.14.1](https://github.com/anzusystems/common-admin/compare/1.14.0...1.14.1) (2023-08-23)

### Features
* **chore:** updated dependencies

### Bug Fixes
* **locales:** added missing vuetify translation added in vuetify@3.3.13

## [1.14.0](https://github.com/anzusystems/common-admin/compare/1.13.0...1.14.0) (2023-08-18)

### Features
* **chore:** updated dependencies

### Bug Fixes
* **ASortable:** fixed types

### BREAKING CHANGES
* **dependencies:** new vuetify required version is `vuetify@3.3.13`

## [1.13.0](https://github.com/anzusystems/common-admin/compare/1.12.0...1.13.0) (2023-08-09)

### Features
* **chore:** updated dependencies
* **docs:** updated editor docs

### BREAKING CHANGES
* **dependencies:** new vuetify required version is `vuetify@3.3.12`

## [1.12.0](https://github.com/anzusystems/common-admin/compare/1.11.0...1.12.0) (2023-08-02)

### Features
* **chore:** updated dependencies
* **docs:** updated editor docs

### BREAKING CHANGES
* **dependencies:** new vuetify required version is `vuetify@3.3.11`

## [1.11.0](https://github.com/anzusystems/common-admin/compare/1.10.0...1.11.0) (2023-07-31)

### Features
* **chore:** updated dependencies
* **docs:** updated editor docs

### BREAKING CHANGES
* **dependencies:** new required versions:
  * `@vueuse/core@10.3.0`
  * `@vueuse/integrations@10.3.0`

## [1.10.0](https://github.com/anzusystems/common-admin/compare/1.9.0...1.10.0) (2023-07-23)

### Features
* **chore:** updated dependencies
* **docs:** updated editor docs

### BREAKING CHANGES
* **usePagination:** default `sortBy` changed from `createdAt` to `id`
* **dependencies:** new vuetify required version is `vuetify@3.3.10`

## [1.9.0](https://github.com/anzusystems/common-admin/compare/1.8.0...1.9.0) (2023-07-20)

### Features
* **chore:** updated dependencies
* **docs:** updated editor docs

### BREAKING CHANGES
* **dependencies:** new vuetify required version is `vuetify@3.3.9`

## [1.8.0](https://github.com/anzusystems/common-admin/compare/1.7.0...1.8.0) (2023-07-07)

### Features
* **chore:** updated dependencies

### BREAKING CHANGES
* **dependencies:** new vue-router required version is `vue-router@4.2.4`

## [1.7.0](https://github.com/anzusystems/common-admin/compare/1.6.0...1.7.0) (2023-07-06)

### Features
* **ADatetimePicker:** instead of using one default language, component is now using system language for translations
* **chore:** updated dependencies
* **docs:** added wip docs for editor

### Bug Fixes
* **AAssetSelect:** confirm returns raw objects instead of proxies
* **size:** reduced size by removing unused flatpickr translations

### BREAKING CHANGES
* **dependencies:** new vuetify required version is `vuetify@3.3.7`

## [1.6.0](https://github.com/anzusystems/common-admin/compare/1.5.0...1.6.0) (2023-07-03)

### Features
* **chore:** updated dependencies

### BREAKING CHANGES
* **dependencies:** new dayjs required version is `dayjs@1.11.9`

## [1.5.0](https://github.com/anzusystems/common-admin/compare/1.4.2...1.5.0) (2023-06-30)

### Features
* **AAssetSelect:** added additional ways to open dialog, added possibility to return additional types, huge refactor, bug fixes
* **chore:** updated dependencies

### BREAKING CHANGES
* **AAssetSelect:** changed activator slot, emits and return type
* **dependencies:** new required versions:
  * `vuetify@3.3.6`
  * `@vuelidate/core@2.0.3`
  * `@vuelidate/validators@2.0.3`
  * `@vueuse/core@10.2.1`
  * `@vueuse/integrations@10.2.1`

## [1.4.2](https://github.com/anzusystems/common-admin/compare/1.4.1...1.4.2) (2023-06-27)

### Bug Fixes
* **types:** fixed enum exports `DamAssetType` and `DamAssetStatus`

## [1.4.1](https://github.com/anzusystems/common-admin/compare/1.4.0...1.4.1) (2023-06-27)

### Features
* **chore:** updated dependencies

### Bug Fixes
* **types:** added missing type exports `DamAssetType` and `DamAssetStatus`

## [1.4.0](https://github.com/anzusystems/common-admin/compare/1.3.0...1.4.0) (2023-06-26)

### Features
* **chore:** updated dependencies

### Bug Fixes
* **tests:** fixed `data-cy` naming

### BREAKING CHANGES
* **dependencies:** new required versions:
  * `vuetify@3.3.5`
  * `@vueuse/core@10.2.0`
  * `@vueuse/integrations@10.2.0`

## [1.3.0](https://github.com/anzusystems/common-admin/compare/1.2.0...1.3.0) (2023-06-14)

### Features
* **ACachedChip:** added `wrap-text` prop to wrap long texts
* **chore:** updated dependencies
* **docs:** updated favicons
* **playground:** updated logo and favicons

### BREAKING CHANGES
* **dependencies:** new vuetify required version is `vuetify@3.3.4`

## [1.2.0](https://github.com/anzusystems/common-admin/compare/1.1.1...1.2.0) (2023-06-08)

### Features
* **chore:** updated dependencies

### BREAKING CHANGES
* **dependencies:** new vuetify required version is `vuetify@3.3.3`

## [1.1.1](https://github.com/anzusystems/common-admin/compare/1.1.0...1.1.1) (2023-06-06)

### Bug Fixes
* **ARow:** fixed default prop value and styling

## [1.1.0](https://github.com/anzusystems/common-admin/compare/1.0.0...1.1.0) (2023-06-06)

### Features
* **docs:** added new documentation using vitepress
* **playground:** old docs/playground changed to new playground with real admin layout
* **chore:** update dev dependencies

### Bug Fixes
* **ADatetimePicker:** undefined window error for shortcut-buttons-flatpickr plugin

## [1.0.0](https://github.com/anzusystems/common-admin/compare/594d9eaf0245a3d09a434304d93bb94c8632bb80...1.0.0) (2023-05-31)

* main stable release
