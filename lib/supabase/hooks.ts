"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

type AsyncFn<Args, Result> = (args: Args) => Promise<Result>;

let queryVersion = 0;
const listeners = new Set<() => void>();
const inFlightQueries = new Map<string, Promise<unknown>>();

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
  const queryKey = useMemo(
    () => `${(fn as { name?: string }).name ?? "anonymous"}:${argsKey}`,
    [fn, argsKey]
  );

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        let promise = inFlightQueries.get(queryKey) as Promise<Result> | undefined;

        if (!promise) {
          promise =
            args === undefined
              ? (fn as () => Promise<Result>)()
              : (fn as AsyncFn<Args, Result>)(args);
          inFlightQueries.set(queryKey, promise);
        }

        const nextData = await promise;
        if (mounted) {
          setData(nextData);
        }
      } catch (error) {
        console.error("Supabase query failed:", error);
      } finally {
        inFlightQueries.delete(queryKey);
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [fn, args, argsKey, queryKey, version]);

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
