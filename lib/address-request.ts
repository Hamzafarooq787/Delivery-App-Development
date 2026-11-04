// Each field owns its requests. A new keystroke or selection cancels the old work.
export const ADDRESS_DEBOUNCE_MS = 220

export function createAddressRequest() {
  let controller: AbortController | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  function cancel() {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    controller?.abort()
  }
  function start() {
    cancel()
    controller = new AbortController()
    return controller.signal
  }
  function search(run: (signal: AbortSignal) => Promise<void>) {
    const signal = start()
    timer = setTimeout(() => { if (!signal.aborted) void run(signal) }, ADDRESS_DEBOUNCE_MS)
  }
  return { cancel, start, search }
}
