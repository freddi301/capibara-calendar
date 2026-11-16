import { take, uniq } from 'es-toolkit'
import { setStored } from './use-stored'

const recentLimit = 5

export function rememberColor(color: string) {
  setStored(({ recentColors }) => ({
    recentColors: take(uniq([color.toLowerCase(), ...recentColors]), recentLimit),
  }))
}
