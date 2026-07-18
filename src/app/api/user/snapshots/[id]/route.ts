import { snapshots } from '../../../../../db/schema';
import { getDb } from '../../../../../db/client';
import { createEntityStore } from '../../../../../server/entityStore';
import { createItemHandlers } from '../../../../../server/entityHandlers';
import { requireUserId } from '../../../../../server/apiHelpers';
import { assetSnapshotSchema } from '../../../../../server/entitySchemas';

const handlers = createItemHandlers({
  store: createEntityStore(snapshots), schema: assetSnapshotSchema, getDb, getUserId: requireUserId,
});
export const { PATCH, DELETE } = handlers;
