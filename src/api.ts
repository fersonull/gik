import { invoke, isTauri } from '@tauri-apps/api/core';
import type { Action, Repository } from './types';
export const desktop = isTauri();
export async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (desktop) return invoke<T>(command, args);
  const { previewCall } = await import('./preview');
  return previewCall<T>(command, args);
}
export const openRepository = (path: string) => call<Repository>('open_repository', { path });
export function query<T>(repository: string, kind: string, options: Record<string, unknown> = {}) {
  return call<T>('query', { request: { repository, kind, ...options } });
}
export const execute = (repository: string, action: Action, job: string, expected?: string) =>
  call<string>('execute', { repository, action, expected: expected ?? null, job });
