/** Bridge the missing H5 cancel callback in the installed UniApp file picker. */
export function watchMediaPickerCancel(onCancel: () => void): () => void {
  let dispose = () => {}
  // #ifdef H5
  let input: HTMLInputElement | null = null
  let stopped = false
  const cancel = () => { if (!stopped) { dispose(); onCancel() } }
  const changed = () => { if (!input?.files?.length) cancel(); else dispose() }
  const clicked = (event: Event) => {
    const target = event.target
    if (input || !(target instanceof HTMLInputElement) || target.type !== 'file') return
    input = target
    input.addEventListener('cancel', cancel)
    input.addEventListener('change', changed)
  }
  // Older browsers without cancel: a subsequent page interaction ends the empty
  // picker. Never use a timeout/focus reset: these can race a successful selection.
  const returned = () => { if (input && !input.files?.length) cancel() }
  dispose = () => {
    stopped = true
    document.removeEventListener('click', clicked, true)
    document.removeEventListener('pointerdown', returned, true)
    input?.removeEventListener('cancel', cancel)
    input?.removeEventListener('change', changed)
  }
  document.addEventListener('click', clicked, true)
  document.addEventListener('pointerdown', returned, true)
  // #endif
  return dispose
}
