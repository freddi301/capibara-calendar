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
