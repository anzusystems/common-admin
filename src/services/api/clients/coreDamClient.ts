// todo move to client
import type { AxiosInstance } from 'axios'
import { isNull } from '@/utils/common'
import axios from 'axios'

let mainInstance: AxiosInstance | null = null

const damClient = function (): AxiosInstance {
  if (isNull(mainInstance)) {
    mainInstance = axios.create({
      baseURL: 'http://core-dam.sme.localhost/api',
      timeout: 15 * 1000,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  return mainInstance
}

export { damClient }
