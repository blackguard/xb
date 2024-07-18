import {
    IndexedDBInterface,
} from 'lib/sys/idb';


export const db_key_settings = 'settings';
export const db_key_themes   = 'themes';
export const db_key_recents  = 'recents';

// database_name and database_store_name use UUIDs, but these must be constant,
// not generated each time the system is loaded.
const uuid = '1bfb0487-7df5-4fba-8825-be10e52298c2';
export const database_name       = `settings-database-${uuid}`;
export const database_store_name = `settings-database-store-${uuid}`;

export const storage_db = new IndexedDBInterface(database_name, database_store_name);
