import { preserveModelEffort } from './reasoning.js'

/**
 * Decorate the public ModelDirectory selection method so both the composer and
 * /model share preservation, including already-created session directories.
 * The owning plugin must dispose this adapter when it unloads.
 */
export function installModelEffortPreservation(prototype) {
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'select')
  const original = descriptor.value
  function select(selection) {
    const state = this.store.getSnapshot()
    return original.call(this, preserveModelEffort(state.pending ?? state.current, selection, state.groups))
  }
  Object.defineProperty(prototype, 'select', { ...descriptor, value: select })
  return () => {
    Object.defineProperty(prototype, 'select', descriptor)
  }
}
