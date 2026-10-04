interface SimpleStorage {
  [key: string]: string;
}

Object.defineProperty(globalThis, 'localStorage', {
  value: (() => {
    let store: SimpleStorage = {};
    return {
      getItem: (key: string): string | null => store[key] ?? null,
      setItem: (key: string, value: string): void => { store[key] = String(value); },
      removeItem: (key: string): void => { delete store[key]; },
      clear: (): void => { store = {}; },
      get length(): number { return Object.keys(store).length; },
      key: (i: number): string | null => Object.keys(store)[i] ?? null,
    };
  })(),
  writable: true,
  configurable: true,
});
