const DB_NAME = "mcraw-converter"
const DB_VERSION = 1
const FILE_STORE = "files"
const METADATA_STORE = "metadata"

interface StoredFile {
  id: string
  filename: string
  data: ArrayBuffer
  createdAt: string
}

interface StoredMetadata {
  id: string
  filename: string
  metadata: any
  thumbnail?: string
  createdAt: string
}

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      if (!db.objectStoreNames.contains(FILE_STORE)) {
        db.createObjectStore(FILE_STORE, { keyPath: "id" })
      }

      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        const metaStore = db.createObjectStore(METADATA_STORE, { keyPath: "id" })
        metaStore.createIndex("filename", "filename", { unique: false })
        metaStore.createIndex("createdAt", "createdAt", { unique: false })
      }
    }
  })
}

export async function storeFile(id: string, filename: string, data: ArrayBuffer): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, "readwrite")
    const store = tx.objectStore(FILE_STORE)

    const record: StoredFile = {
      id,
      filename,
      data,
      createdAt: new Date().toISOString(),
    }

    const request = store.put(record)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export async function getFile(id: string): Promise<ArrayBuffer | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, "readonly")
    const store = tx.objectStore(FILE_STORE)
    const request = store.get(id)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const result = request.result as StoredFile | undefined
      resolve(result?.data || null)
    }
  })
}

export async function deleteFile(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([FILE_STORE, METADATA_STORE], "readwrite")

    tx.objectStore(FILE_STORE).delete(id)
    tx.objectStore(METADATA_STORE).delete(id)

    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function storeMetadata(id: string, filename: string, metadata: any, thumbnail?: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(METADATA_STORE, "readwrite")
    const store = tx.objectStore(METADATA_STORE)

    const record: StoredMetadata = {
      id,
      filename,
      metadata,
      thumbnail,
      createdAt: new Date().toISOString(),
    }

    const request = store.put(record)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export async function getMetadata(id: string): Promise<StoredMetadata | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(METADATA_STORE, "readonly")
    const store = tx.objectStore(METADATA_STORE)
    const request = store.get(id)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result || null)
  })
}

export async function getAllMetadata(): Promise<StoredMetadata[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(METADATA_STORE, "readonly")
    const store = tx.objectStore(METADATA_STORE)
    const request = store.getAll()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result || [])
  })
}

export async function clearAllData(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([FILE_STORE, METADATA_STORE], "readwrite")

    tx.objectStore(FILE_STORE).clear()
    tx.objectStore(METADATA_STORE).clear()

    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
