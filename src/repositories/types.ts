export class ConflictError extends Error {
  constructor(message = '資料已在其他裝置修改') { super(message); }
}

export interface EntityRepository<T extends { id: string }> {
  getAll(): Promise<T[]>;
  create(entity: T): Promise<void>;
  update(entity: T): Promise<void>;
  remove(id: string): Promise<void>;
  replaceAll(entities: T[]): Promise<void>;
}
