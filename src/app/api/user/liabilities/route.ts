import { liabilities } from '../../../../db/schema';
import { getDb } from '../../../../db/client';
import { createEntityStore } from '../../../../server/entityStore';
import { createCollectionHandlers } from '../../../../server/entityHandlers';
import { requireUserId } from '../../../../server/apiHelpers';
import { liabilityItemSchema } from '../../../../server/entitySchemas';

const handlers = createCollectionHandlers({
  store: createEntityStore(liabilities), schema: liabilityItemSchema, getDb, getUserId: requireUserId,
});
export const { GET, POST, PUT } = handlers;
