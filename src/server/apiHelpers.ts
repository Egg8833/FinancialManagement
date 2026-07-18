import { ZodError } from 'zod';
import { auth } from '../auth';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

export async function requireUserId(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new ApiError(401, 'unauthorized', '請先登入');
  return id;
}

export async function handleApi(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiError) {
      return Response.json({ error: { code: e.code, message: e.message } }, { status: e.status });
    }
    if (e instanceof ZodError) {
      return Response.json(
        { error: { code: 'validation_failed', message: e.issues.map(i => i.message).join('; ') } },
        { status: 422 },
      );
    }
    if (e instanceof SyntaxError) {
      return Response.json(
        { error: { code: 'validation_failed', message: '請求格式錯誤' } },
        { status: 422 },
      );
    }
    console.error('[api] unhandled error', e);
    return Response.json({ error: { code: 'internal_error', message: '伺服器錯誤' } }, { status: 500 });
  }
}
