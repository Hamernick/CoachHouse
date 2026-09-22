import type { BrandAssetId, StoredBrandAsset } from "../types"

const DATABASE_NAME = "coach-house-documentation"
const STORE_NAME = "brand-identity-assets"
const DATABASE_VERSION = 1

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transact<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
) {
  return openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        try {
          const transaction = database.transaction(STORE_NAME, mode)
          const request = operation(transaction.objectStore(STORE_NAME))
          transaction.oncomplete = () => {
            database.close()
            resolve(request.result)
          }
          const fail = () => {
            database.close()
            reject(
              transaction.error ??
                request.error ??
                new Error("Image storage transaction failed")
            )
          }
          transaction.onerror = fail
          transaction.onabort = fail
          request.onerror = fail
        } catch (error) {
          database.close()
          reject(error)
        }
      })
  )
}

export function loadBrandAssets() {
  if (typeof indexedDB === "undefined")
    return Promise.reject(new Error("Image storage unavailable"))
  return transact<StoredBrandAsset[]>("readonly", (store) => store.getAll())
}

export function saveBrandAsset(asset: StoredBrandAsset) {
  return transact<IDBValidKey>("readwrite", (store) => store.put(asset))
}

export function removeBrandAsset(id: BrandAssetId) {
  return transact<undefined>("readwrite", (store) => store.delete(id))
}

export function clearBrandAssets() {
  return transact<undefined>("readwrite", (store) => store.clear())
}
