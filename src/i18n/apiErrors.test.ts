// @vitest-environment node
import { it, expect, describe } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { en } from './en';

const backend = path.join(import.meta.dirname, '../../ecommerce-backend');

function readSources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return ['node_modules', 'dist', 'test'].includes(entry.name) ? [] : readSources(entryPath);
    }
    return entry.name.endsWith('.js') ? [fs.readFileSync(entryPath, 'utf8')] : [];
  });
}

describe("the API's refusal codes", () => {
  it('each have a message in the store, and the store has none the API never sends', () => {
    const sentCodes = new Set(readSources(backend).flatMap((source) => [...source.matchAll(/refusal\('(\w+)'/g)].map(([, code]) => code)));

    expect([...sentCodes].sort()).toEqual(Object.keys(en.apiErrors).sort());
  });
});
