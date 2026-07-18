import { assets } from '../../../../../db/schema';
import { getDb } from '../../../../../db/client';
import { createEntityStore } from '../../../../../server/entityStore';
import { createItemHandlers } from '../../../../../server/entityHandlers';
import { requireUserId } from '../../../../../server/apiHelpers';
import { assetCategorySchema } from '../../../../../server/entitySchemas';

const handlers = createItemHandlers({
  store: createEntityStore(assets), schema: assetCategorySchema, getDb, getUserId: requireUserId,
});
export const { PATCH, DELETE } = handlers;
