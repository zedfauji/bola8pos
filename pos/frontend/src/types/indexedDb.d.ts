declare module '@/lib/indexedDb' {
  interface IDBObjectStore {
    indexNames: DOMStringList;
    keyPath: string | string[];
    name: string;
    transaction: IDBTransaction;
    autoIncrement: boolean;
    add(value: any, key?: IDBValidKey): IDBRequest<IDBValidKey>;
    clear(): IDBRequest<undefined>;
    count(key?: IDBValidKey | IDBKeyRange): IDBRequest<number>;
    createIndex(name: string, keyPath: string | string[], options?: IDBIndexParameters): IDBIndex;
    delete(key: IDBValidKey | IDBKeyRange): IDBRequest<undefined>;
    deleteIndex(name: string): void;
    get(key: IDBValidKey | IDBKeyRange): IDBRequest<any>;
    getAll(query?: IDBValidKey | IDBKeyRange | null, count?: number): IDBRequest<any[]>;
    getAllKeys(query?: IDBValidKey | IDBKeyRange | null, count?: number): IDBRequest<IDBValidKey[]>;
    getKey(key: IDBValidKey | IDBKeyRange): IDBRequest<IDBValidKey | undefined>;
    index(name: string): IDBIndex;
    openCursor(query?: IDBValidKey | IDBKeyRange | null, direction?: IDBCursorDirection): IDBRequest<IDBCursorWithValue | null>;
    openKeyCursor(query?: IDBValidKey | IDBKeyRange | null, direction?: IDBCursorDirection): IDBRequest<IDBCursor | null>;
    put(value: any, key?: IDBValidKey): IDBRequest<IDBValidKey>;
  }

  const indexedDB: {
    db: IDBDatabase | null;
    init(): Promise<IDBDatabase>;
    getDB(): Promise<IDBDatabase>;
    getObjectStore(storeName: string, mode?: IDBTransactionMode): Promise<IDBObjectStore>;
    getAll(storeName: string): Promise<any[]>;
    get(storeName: string, key: IDBValidKey): Promise<any>;
    add(storeName: string, value: any, key?: IDBValidKey): Promise<IDBValidKey>;
    put(storeName: string, value: any, key?: IDBValidKey): Promise<IDBValidKey>;
    delete(storeName: string, key: IDBValidKey): Promise<void>;
    clear(storeName: string): Promise<void>;
    count(storeName: string, query?: IDBValidKey | IDBKeyRange): Promise<number>;
  };

  export default indexedDB;
}
