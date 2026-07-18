import { describe, it, expect } from 'vitest';
import type { EntityRepository } from './types';

type Item = { id: string; name: string };

export function runRepositoryContract(
  name: string,
  makeRepo: () => Promise<EntityRepository<Item>>,
) {
  describe(`${name}(repository 契約)`, () => {
    it('初始 getAll 後 create 可讀回', async () => {
      const repo = await makeRepo();
      await repo.getAll();
      await repo.create({ id: 'a', name: '甲' });
      expect(await repo.getAll()).toEqual([{ id: 'a', name: '甲' }]);
    });

    it('update 以 id 整筆取代', async () => {
      const repo = await makeRepo();
      await repo.getAll();
      await repo.create({ id: 'a', name: '甲' });
      await repo.update({ id: 'a', name: '乙' });
      expect(await repo.getAll()).toEqual([{ id: 'a', name: '乙' }]);
    });

    it('remove 刪除指定 id', async () => {
      const repo = await makeRepo();
      await repo.getAll();
      await repo.create({ id: 'a', name: '甲' });
      await repo.create({ id: 'b', name: '乙' });
      await repo.remove('a');
      expect(await repo.getAll()).toEqual([{ id: 'b', name: '乙' }]);
    });

    it('replaceAll 整批取代並保持順序', async () => {
      const repo = await makeRepo();
      await repo.getAll();
      await repo.create({ id: 'old', name: '舊' });
      await repo.replaceAll([{ id: 'n2', name: '2' }, { id: 'n1', name: '1' }]);
      expect((await repo.getAll()).map(i => i.id)).toEqual(['n2', 'n1']);
    });
  });
}
