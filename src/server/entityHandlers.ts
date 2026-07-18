import { z, type ZodType } from 'zod';
import type { Db } from '../db/client';
import type { EntityStore } from './entityStore';
import { handleApi } from './apiHelpers';

type HandlerDeps = {
  store: EntityStore;
  schema: ZodType;
  getDb: () => Db;
  getUserId: () => Promise<string>;
};

const idSchema = z.object({ id: z.string() });

export function createCollectionHandlers({ store, schema, getDb, getUserId }: HandlerDeps) {
  return {
    GET: (_req: Request) => handleApi(async () => {
      const userId = await getUserId();
      const items = await store.getAll(getDb(), userId);
      return Response.json({ items });
    }),

    POST: (req: Request) => handleApi(async () => {
      const userId = await getUserId();
      const { data } = z.object({ data: schema }).parse(await req.json());
      const { id } = idSchema.parse(data);
      await store.create(getDb(), userId, id, data);
      return Response.json({ version: 1 }, { status: 201 });
    }),

    PUT: (req: Request) => handleApi(async () => {
      const userId = await getUserId();
      const { data } = z.object({ data: z.array(schema) }).parse(await req.json());
      const rows = data.map(d => ({ id: idSchema.parse(d).id, data: d }));
      await store.replaceAll(getDb(), userId, rows);
      return Response.json({ ok: true });
    }),
  };
}

export function createItemHandlers({ store, schema, getDb, getUserId }: HandlerDeps) {
  return {
    PATCH: (req: Request, ctx: { params: Promise<{ id: string }> }) => handleApi(async () => {
      const userId = await getUserId();
      const { id } = await ctx.params;
      const { data, version } = z.object({ data: schema, version: z.number().int() }).parse(await req.json());
      const newVersion = await store.update(getDb(), userId, id, data, version);
      return Response.json({ version: newVersion });
    }),

    DELETE: (_req: Request, ctx: { params: Promise<{ id: string }> }) => handleApi(async () => {
      const userId = await getUserId();
      const { id } = await ctx.params;
      await store.remove(getDb(), userId, id);
      return Response.json({ ok: true });
    }),
  };
}
