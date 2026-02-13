import { useEffect } from 'react'

export function useIpcListener<T>(
  subscribe: (callback: (...args: T[]) => void) => () => void,
  callback: (...args: T[]) => void,
  deps: unknown[] = [],
) {
  useEffect(() => {
    const unsub = subscribe(callback)
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
