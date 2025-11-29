

const DB_NAME = 'TessOS_DB_v1';
const STORE_NAME = 'keyval';

// Simple Promise-based IndexedDB wrapper
export const db = {
  get: (key: string) => new Promise<any>((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) return resolve(null);
    const req = window.indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e: any) => {
        if (!e.target.result.objectStoreNames.contains(STORE_NAME)) {
            e.target.result.createObjectStore(STORE_NAME);
        }
    };
    req.onsuccess = (e: any) => {
      try {
          const t = e.target.result.transaction(STORE_NAME, 'readonly');
          const s = t.objectStore(STORE_NAME).get(key);
          s.onsuccess = () => resolve(s.result);
          s.onerror = () => resolve(null);
      } catch (err) {
          resolve(null);
      }
    };
    req.onerror = () => resolve(null);
  }),
  
  set: (key: string, val: any) => new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) return resolve();
    const req = window.indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e: any) => {
         if (!e.target.result.objectStoreNames.contains(STORE_NAME)) {
            e.target.result.createObjectStore(STORE_NAME);
        }
    };
    req.onsuccess = (e: any) => {
      const t = e.target.result.transaction(STORE_NAME, 'readwrite');
      const store = t.objectStore(STORE_NAME);
      store.put(val, key);
      t.oncomplete = () => resolve();
      t.onerror = (e: any) => reject(e);
    };
    req.onerror = (e: any) => reject(e);
  }),

  del: (key: string) => new Promise<void>((resolve) => {
     if (typeof window === 'undefined' || !window.indexedDB) return resolve();
     const req = window.indexedDB.open(DB_NAME, 1);
     req.onsuccess = (e: any) => {
         const t = e.target.result.transaction(STORE_NAME, 'readwrite');
         t.objectStore(STORE_NAME).delete(key);
         t.oncomplete = () => resolve();
     }
  })
};