import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

// D1-compatible adapter adapted from the private CRM's SQLite test adapter.
export function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  for (const name of readdirSync(new URL('./schema/', import.meta.url)).filter(n => n.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(new URL(`./schema/${name}`, import.meta.url), 'utf8'));
  }
  class Statement {
    constructor(sql, params = []) { this.sql = sql; this.params = params; }
    bind(...params) { return new Statement(this.sql, params); }
    async first() { return sqlite.prepare(this.sql).get(...this.params) ?? null; }
    async all() { return { results: sqlite.prepare(this.sql).all(...this.params) }; }
    run() {
      if (/^\s*(SELECT|WITH)/i.test(this.sql)) return { results: sqlite.prepare(this.sql).all(...this.params), meta: { changes: 0 } };
      const result = sqlite.prepare(this.sql).run(...this.params);
      return { results: [], meta: { changes: Number(result.changes) } };
    }
  }
  return {
    sqlite,
    prepare: sql => new Statement(sql),
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = statements.map(statement => statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
    close: () => sqlite.close(),
  };
}
