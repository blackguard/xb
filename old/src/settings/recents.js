import {
    db_key_recents,
    storage_db,
} from './storage.js';


// === STORAGE ===

export const max_recents = 100;  // the maximum number of elements to store

export function is_valid_recent(recent) {
    const FSFH = globalThis.FileSystemFileHandle ?? null;  // not defined in all browsers at this time
    return ( typeof recent === 'object' &&
             recent.file_handle instanceof FSFH &&
             typeof recent.stats === 'object' &&
             typeof recent.stats.name === 'string'
           );
}

// may throw an error
export async function get_recents() {
    let recents = await storage_db.get(db_key_recents);
    if (Array.isArray(recents) && recents.every(is_valid_recent)) {
        return recents;
    } else {
        const reinitialized_recents = [];
        await storage_db.put(db_key_recents, reinitialized_recents);
        return reinitialized_recents;
    }
}

// may throw an error
export async function add_to_recents(recent) {
    if (!is_valid_recent(recent)) {
        throw new Error('invalid recent object');
    }
    const recents = await get_recents();
    const new_recents = [ recent ];
    for (const r of recents) {
        if (new_recents.length >= max_recents) {
            break;
        }
        if (!(await r.file_handle.isSameEntry(recent.file_handle))) {
            new_recents.push(r);
        }
    }
    return storage_db.put(db_key_recents, new_recents);
}

// may throw an error
export async function clear_recents(file_handle) {
    return storage_db.put(db_key_recents, []);
}
