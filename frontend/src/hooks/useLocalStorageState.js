import { useState, useEffect } from "react";

/**
 * useLocalStorageState
 *
 * Drop-in replacement for `useState` that persists its value to
 * localStorage under `key`, so it survives unmount/remount (e.g. a table
 * tab that gets torn down and rebuilt on every switch) and page refreshes.
 *
 * `defaultValue` may be a plain value or a lazy initializer function, same
 * as `useState`. Transparently round-trips `Set` instances (column-hidden
 * state is commonly a Set) through JSON, since `JSON.stringify` on a Set
 * would otherwise produce `{}`.
 *
 * @param {string} key
 * @param {*|(() => *)} defaultValue
 * @returns {[*, Function]}
 */
export function useLocalStorageState(key, defaultValue) {
  const [state, setState] = useState(() => {
    if (typeof window === "undefined") {
      return typeof defaultValue === "function" ? defaultValue() : defaultValue;
    }
    try {
      const raw = window.localStorage.getItem(key);
      if (raw == null) {
        return typeof defaultValue === "function" ? defaultValue() : defaultValue;
      }
      const parsed = JSON.parse(raw);
      if (parsed && parsed.__type === "Set") return new Set(parsed.value);
      return parsed;
    } catch {
      return typeof defaultValue === "function" ? defaultValue() : defaultValue;
    }
  });

  useEffect(() => {
    try {
      const toStore =
        state instanceof Set ? { __type: "Set", value: [...state] } : state;
      window.localStorage.setItem(key, JSON.stringify(toStore));
    } catch {
      // Quota exceeded or value not serializable — persistence is a nice-to-have,
      // not worth crashing the table over.
    }
  }, [key, state]);

  return [state, setState];
}

export default useLocalStorageState;
