/** Bound UI work even if an SDK promise does not respond to cancellation. */
export async function shortRequest<T>(work: PromiseLike<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([work, new Promise<never>((_,reject) => {
      timer = setTimeout(() => reject(new Error("Request timed out")),ms)
    })])
  } finally { clearTimeout(timer) }
}

export function boundedFetch(ms: number): typeof fetch {
  return (input, options) => {
    const timeout = AbortSignal.timeout(ms)
    return fetch(input,{...options, signal:options?.signal ? AbortSignal.any([timeout,options.signal]) : timeout})
  }
}
