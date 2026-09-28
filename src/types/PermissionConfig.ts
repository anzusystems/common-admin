import type { GrantType } from '@/model/valueObject/Grant'

export interface PermissionConfig {
  roles: string[]
  defaultGrants: GrantType[]
  config: {
    [subject: string]: {
      [action: string]: {
        grants?: GrantType[]
      }
    }
  }
  translation: {
    subjects: {
      [subject: string]: {
        [lang: string]: string
      }
    }
    actions: {
      [action: string]: {
        [lang: string]: string
      }
    }
    roles: {
      [role: string]: {
        [lang: string]: string
      }
    }
  }
}

export type PermissionTranslationGroup = 'subjects' | 'actions' | 'roles'
