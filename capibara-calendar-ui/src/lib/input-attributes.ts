export const addressInput = {
  inputMode: 'url',
  autoCapitalize: 'none',
  autoCorrect: 'off',
  spellCheck: false,
  autoComplete: 'url',
} as const

export const usernameInput = {
  autoCapitalize: 'none',
  autoCorrect: 'off',
  spellCheck: false,
  autoComplete: 'username',
} as const

export const passwordInput = {
  type: 'password',
  autoComplete: 'current-password',
} as const

export const nameInput = { autoComplete: 'off' } as const

export const numberInput = { type: 'number', min: 1, inputMode: 'numeric' } as const

export const linkInput = {
  inputMode: 'url',
  autoComplete: 'off',
  autoCapitalize: 'none',
  spellCheck: false,
} as const
