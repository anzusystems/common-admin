// @ts-ignore // todo
import { v1 as uuidv1, v4 as uuidv4 } from 'uuid'

export const generateUUIDv1 = () => {
  return uuidv1()
}

export const generateUUIDv4 = () => {
  return uuidv4()
}
