import { assets, liabilities, snapshots } from '../../../../db/schema';
import { getDb } from '../../../../db/client';
import { createEntityStore } from '../../../../server/entityStore';
import { handleApi, requireUserId } from '../../../../server/apiHelpers';

export const GET = () => handleApi(async () => {
  const userId = await requireUserId();
  const db = getDb();
  const [a, l, s] = await Promise.all([
    createEntityStore(assets).hasAny(db, userId),
    createEntityStore(liabilities).hasAny(db, userId),
    createEntityStore(snapshots).hasAny(db, userId),
  ]);
  return Response.json({ assets: a, liabilities: l, snapshots: s });
});
