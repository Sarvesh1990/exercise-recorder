/**
 * IndexedDB wrapper for offline-first exercise storage.
 * All data is stored locally in IndexedDB and synced to the server when online.
 */
const ExerciseDB = (() => {
  const DB_NAME = 'ExerciseRecorderDB';
  const DB_VERSION = 1;
  const STORE = 'exercises';
  let _db = null;

  function open() {
    return new Promise((resolve, reject) => {
      if (_db) return resolve(_db);
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('created_at', 'created_at', { unique: false });
          store.createIndex('synced', 'synced', { unique: false });
        }
      };

      req.onsuccess = (e) => {
        _db = e.target.result;
        resolve(_db);
      };
      req.onerror = () => reject(req.error);
    });
  }

  function generateId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  async function add(entry) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const item = {
        id: entry.id || generateId(),
        name: entry.name.trim().toLowerCase(),
        weight: parseFloat(entry.weight),
        reps: entry.reps ? parseInt(entry.reps) : null,
        sets: entry.sets ? parseInt(entry.sets) : null,
        unit: entry.unit || 'kg',
        notes: entry.notes || '',
        created_at: entry.created_at || new Date().toISOString(),
        synced: false
      };
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(item);
      tx.oncomplete = () => resolve(item);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getAll() {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => {
        const sorted = req.result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        resolve(sorted);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function getByName(name) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const idx = tx.objectStore(STORE).index('name');
      const req = idx.getAll(name.toLowerCase());
      req.onsuccess = () => {
        const sorted = req.result.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        resolve(sorted);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function getNames() {
    const all = await getAll();
    const counts = {};
    all.forEach(e => {
      const n = e.name.toLowerCase();
      counts[n] = (counts[n] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }

  async function getLastByName(name) {
    const entries = await getByName(name);
    if (entries.length === 0) return null;
    return entries.reduce((latest, e) =>
      new Date(e.created_at) > new Date(latest.created_at) ? e : latest
    );
  }

  async function remove(id) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getUnsynced() {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const idx = tx.objectStore(STORE).index('synced');
      const req = idx.getAll(false);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function markSynced(ids) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      ids.forEach(id => {
        const req = store.get(id);
        req.onsuccess = () => {
          if (req.result) {
            req.result.synced = true;
            store.put(req.result);
          }
        };
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function sync() {
    if (!navigator.onLine) return { synced: 0 };

    const unsynced = await getUnsynced();
    if (unsynced.length === 0) return { synced: 0 };

    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: unsynced })
      });

      if (res.ok) {
        await markSynced(unsynced.map(e => e.id));
        return { synced: unsynced.length };
      }
    } catch (err) {
      console.warn('Sync failed, will retry later:', err);
    }

    return { synced: 0 };
  }

  return { open, add, getAll, getByName, getLastByName, getNames, remove, getUnsynced, sync };
})();
