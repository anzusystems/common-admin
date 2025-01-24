import type { BaseUser } from '@/types/AnzuUser'

export function useBaseUserFactory() {
  const createBaseUser = (): BaseUser => {
    return {
      id: null,
      email: '',
      avatar: {
        color: '',
        text: '',
      },
      person: {
        firstName: '',
        fullName: '',
        lastName: '',
      },
    }
  }

  return {
    createBaseUser,
  }
}
