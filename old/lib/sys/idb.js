export class IndexedDBInterface {
    constructor(database_name, database_store_name) {
        if (typeof database_name !== 'string' || typeof database_store_name !== 'string') {
            throw new Error('database_name and database_store_name must be strings');
        }
        Object.defineProperties(this, {
            database_name: {
                value: database_name,
            },
            database_store_name: {
                value: database_store_name,
                enumerable: true,
            },
            _startup_promise: {
                value: new Promise((resolve, reject) => {
                    const request = indexedDB.open(database_name, 1);
                    request.onerror   = () => reject(request.error);
                    request.onsuccess = () => resolve(request.result);
                    request.onupgradeneeded = () => {
                        // create empty object store (first time upgrade)
                        request.result.createObjectStore(database_store_name);
                    };
                }),
            },
        });
    }

    async with_object_store(mode, receiver) {
        const db = await this._startup_promise;
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.database_store_name, mode);
            transaction.oncomplete = () => resolve();
            transaction.onabort = transaction.onerror = () => reject(transaction.error);
            receiver(transaction.objectStore(this.database_store_name));
        });
    }

    async get(key) {
        let req;
        await this.with_object_store('readonly', store => {
            req = store.get(key);
        });
        return req.result;
    }

    async put(key, value) {
        return this.with_object_store('readwrite', store => {
            store.put(value, key);
        });
    }

    async delete(key) {
        return this.with_object_store('readwrite', store => {
            store.delete(key);
        });
    }

    async clear() {
        return this.with_object_store('readwrite', store => {
            store.clear();
        });
    }

    async keys() {
        let req;
        await this.with_object_store('readonly', store => {
            req = store.getAllKeys();
        });
        return req.result;
    }
}
