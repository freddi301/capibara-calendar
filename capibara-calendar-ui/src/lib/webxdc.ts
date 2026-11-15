export const isWebxdc = () => window.webxdc !== undefined

/** The address that the chat gives to this person in this app, when the app is a webxdc one. */
export const webxdcSelfAddr = () => window.webxdc?.selfAddr

/** This person as the chat knows them: the address and the name. Only in a chat. */
export const webxdcSelf = () =>
  window.webxdc ? { id: window.webxdc.selfAddr, name: window.webxdc.selfName } : undefined
