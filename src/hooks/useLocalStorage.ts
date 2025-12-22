import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Serializer<T> = (value: T) => string;
type Deserializer<T> = (raw: string) => T;

type UseLocalStorageOptions<T> = {
  /**
   * Version du contenu stocké.
   * Si la version stockée diffère, on applique migrate() (si fournie) ou on réinitialise.
   */
  version?: number;

  /**
   * Migration quand la version change.
   * oldValue = ce qui est en storage (déjà deserializé via deserialize).
   */
  migrate?: (oldValue: unknown, fromVersion: number, toVersion: number) => T;

  /**
   * Forcer l’import si la valeur locale est “vide”.
   * Ex: pour des arrays => (v) => v.length === 0
   */
  requireImportWhen?: (value: T) => boolean;

  /**
   * Sérialisation / désérialisation custom (par défaut JSON)
   */
  serialize?: Serializer<T>;
  deserialize?: Deserializer<T>;

  /**
   * Écouter les changements depuis d'autres onglets
   */
  syncAcrossTabs?: boolean;

  /**
   * Log d’erreur
   */
  onError?: (err: unknown) => void;
};

type StoredEnvelope = {
  __v: number; // version
  __t: number; // timestamp
  data: unknown;
};

const DEFAULT_VERSION = 1;

function defaultSerialize<T>(value: T) {
  const env: StoredEnvelope = { __v: DEFAULT_VERSION, __t: Date.now(), data: value };
  return JSON.stringify(env);
}

function defaultDeserialize<T>(raw: string): { version: number; data: T | unknown } {
  const parsed = JSON.parse(raw) as StoredEnvelope | T;
  if (typeof parsed === "object" && parsed !== null && "__v" in (parsed as any) && "data" in (parsed as any)) {
    const env = parsed as StoredEnvelope;
    return { version: env.__v ?? DEFAULT_VERSION, data: env.data };
  }
  // rétro-compat : ancien format sans enveloppe
  return { version: 0, data: parsed as unknown };
}

function safeParse<T>(
  key: string,
  raw: string,
  initialValue: T,
  options: UseLocalStorageOptions<T>
): { value: T; version: number } {
  try {
    const deserialize = options.deserialize ?? ((r: string) => defaultDeserialize<T>(r));
    const result = deserialize(raw) as any;

    // Si le deserialize custom renvoie directement T
    if (result && typeof result === "object" && "data" in result && "version" in result) {
      return { value: result.data as T, version: Number(result.version) || 0 };
    }

    // fallback
    const { version, data } = defaultDeserialize<T>(raw);
    return { value: data as T, version: version || 0 };
  } catch (err) {
    (options.onError ?? console.error)(`useLocalStorage: JSON invalide pour "${key}"`, err);
    return { value: initialValue, version: 0 };
  }
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options: UseLocalStorageOptions<T> = {}
) {
  const {
    version = DEFAULT_VERSION,
    migrate,
    requireImportWhen,
    serialize,
    deserialize,
    syncAcrossTabs = true,
    onError,
  } = options;

  const lastWrittenRef = useRef<string | null>(null);

  const readValue = useCallback((): T => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return initialValue;

      const { value, version: storedVersion } = safeParse(key, raw, initialValue, { deserialize, onError });

      if (storedVersion === version) return value as T;

      // migration
      if (migrate) {
        const migrated = migrate(value, storedVersion, version);
        // save migrated immediately
        const s = (serialize ?? defaultSerialize)(migrated);
        localStorage.setItem(key, s);
        lastWrittenRef.current = s;
        return migrated;
      }

      // pas de migrate : reset
      return initialValue;
    } catch (err) {
      (onError ?? console.error)(err);
      return initialValue;
    }
  }, [key, initialValue, version, migrate, serialize, deserialize, onError]);

  const [storedValue, setStoredValue] = useState<T>(() => readValue());

  // Sync onglets
  useEffect(() => {
    if (!syncAcrossTabs) return;

    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== localStorage) return;
      if (e.key !== key) return;

      // ignore self-write (best effort)
      if (e.newValue && lastWrittenRef.current && e.newValue === lastWrittenRef.current) return;

      setStoredValue(readValue());
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key, readValue, syncAcrossTabs]);

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);

        const s = serialize
          ? serialize(valueToStore)
          : JSON.stringify({ __v: version, __t: Date.now(), data: valueToStore } satisfies StoredEnvelope);

        localStorage.setItem(key, s);
        lastWrittenRef.current = s;
      } catch (err: any) {
        // QuotaExceededError / etc
        (onError ?? console.error)("useLocalStorage: erreur d’écriture", err);
      }
    },
    [key, storedValue, serialize, version, onError]
  );

  const removeValue = useCallback(() => {
    try {
      localStorage.removeItem(key);
      setStoredValue(initialValue);
      lastWrittenRef.current = null;
    } catch (err) {
      (onError ?? console.error)("useLocalStorage: erreur de suppression", err);
    }
  }, [key, initialValue, onError]);

  const needsImport = useMemo(() => {
    if (!requireImportWhen) return false;
    try {
      return requireImportWhen(storedValue);
    } catch {
      return false;
    }
  }, [requireImportWhen, storedValue]);

  /**
   * Helper: ouvre un sélecteur fichier et renvoie le contenu.
   * Usage typique : requestImport({ accept: ".csv,.json", parse: "text" })
   */
  const requestImport = useCallback(
    async (opts?: {
      accept?: string; // ".csv,.json"
      parse?: "text" | "json" | "arrayBuffer";
      multiple?: boolean;
    }) => {
      const { accept = ".json,.csv,text/csv,application/json", parse = "text", multiple = false } = opts ?? {};

      return new Promise<
        | { file: File; text: string }
        | { file: File; json: unknown }
        | { file: File; arrayBuffer: ArrayBuffer }
      >((resolve, reject) => {
        try {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = accept;
          input.multiple = multiple;

          input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return reject(new Error("Aucun fichier sélectionné"));

            try {
              if (parse === "arrayBuffer") {
                const arrayBuffer = await file.arrayBuffer();
                return resolve({ file, arrayBuffer });
              }

              const text = await file.text();

              if (parse === "json") {
                const json = JSON.parse(text);
                return resolve({ file, json });
              }

              return resolve({ file, text });
            } catch (err) {
              reject(err);
            }
          };

          input.click();
        } catch (err) {
          reject(err);
        }
      });
    },
    []
  );

  return {
    value: storedValue,
    setValue,
    removeValue,
    needsImport,
    requestImport,
  } as const;
}
