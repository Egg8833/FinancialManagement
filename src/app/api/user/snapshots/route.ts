import { snapshots } from '../../../../db/schema';
import { getDb } from '../../../../db/client';
import { createEntityStore } from '../../../../server/entityStore';
import { createCollectionHandlers } from '../../../../server/entityHandlers';
import { requireUserId } from '../../../../server/apiHelpers';
import { assetSnapshotSchema } from '../../../../server/entitySchemas';

const handlers = createCollectionHandlers({
  store: createEntityStore(snapshots), schema: assetSnapshotSchema, getDb, getUserId: requireUserId,
});
export const { GET, POST, PUT } = handlers;
