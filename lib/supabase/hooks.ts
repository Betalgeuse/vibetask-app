"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

type AsyncFn<Args, Result> = (args: Args) => Promise<Result>;

let queryVersion = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return queryVersion;
}

function bumpVersion() {
  queryVersion += 1;
  listeners.forEach((listener) => listener());
}

export function invalidateSupabaseQueries() {
  bumpVersion();
}

function useVersion() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useQuery<Args, Result>(
  fn: AsyncFn<Args, Result> | (() => Promise<Result>),
  args?: Args
) {
  const version = useVersion();
  const [data, setData] = useState<Result | undefined>(undefined);

  const argsKey = useMemo(() => JSON.stringify(args ?? null), [args]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      const nextData =
        args === undefined
          ? await (fn as () => Promise<Result>)()
          : await (fn as AsyncFn<Args, Result>)(args);

      if (mounted) {
        setData(nextData);
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [fn, args, argsKey, version]);

  return data;
}

export function useMutation<Args, Result>(fn: AsyncFn<Args, Result>) {
  return useCallback(
    async (args: Args) => {
      const result = await fn(args);
      bumpVersion();
      return result;
    },
    [fn]
  );
}

export function useAction<Args, Result>(fn: AsyncFn<Args, Result>) {
  return useCallback(
    async (args: Args) => {
      const result = await fn(args);
      bumpVersion();
      return result;
    },
    [fn]
  );
}
