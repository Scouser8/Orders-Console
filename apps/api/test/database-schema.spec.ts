import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

describe('database schema', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');

    const migrations = new URL('../prisma/migrations/', import.meta.url);
    const entries = readdirSync(migrations, { withFileTypes: true }).sort(
      (a, b) => a.name.localeCompare(b.name),
    );
    for (const entry of entries) {
      if (entry.isDirectory()) {
        db.exec(
          readFileSync(
            new URL(`${entry.name}/migration.sql`, migrations),
            'utf8',
          ),
        );
      }
    }

    db.prepare(
      'INSERT INTO "User" (id, email, passwordHash) VALUES (?, ?, ?)',
    ).run('agent', 'agent@example.com', 'test-password-hash');
    insertOrder('order');
  });

  afterEach(() => {
    db.close();
  });

  function insertOrder(id: string) {
    db.prepare(
      'INSERT INTO "Order" (id, customerName, customerEmail, totalAmount) VALUES (?, ?, ?, ?)',
    ).run(id, 'Test Customer', 'customer@example.com', 1000);
  }

  it('defaults to agent permissions and pending orders, and rejects invalid enum values', () => {
    expect(db.prepare('SELECT role FROM "User"').get()).toEqual({
      role: 'AGENT',
    });
    expect(db.prepare('SELECT status FROM "Order"').get()).toEqual({
      status: 'PENDING',
    });
    expect(() => db.exec('UPDATE "User" SET role = \'OWNER\'')).toThrow(
      /CHECK/,
    );
    expect(() => db.exec('UPDATE "Order" SET status = \'UNKNOWN\'')).toThrow(
      /CHECK/,
    );
  });

  it('enforces unique user emails', () => {
    expect(() =>
      db
        .prepare(
          'INSERT INTO "User" (id, email, passwordHash) VALUES (?, ?, ?)',
        )
        .run('other-agent', 'agent@example.com', 'test-password-hash'),
    ).toThrow(/UNIQUE/);
  });

  it.each([-1, 0.5, 2147483648])(
    'rejects invalid total amounts: %s',
    (amount) => {
      expect(() =>
        db.prepare('UPDATE "Order" SET totalAmount = ?').run(amount),
      ).toThrow(/CHECK/);
    },
  );

  it.each([
    [0, 100],
    [-1, 100],
    [1.5, 100],
    [2147483648, 100],
    [1, -1],
    [1, 0.5],
    [1, 2147483648],
  ])(
    'rejects invalid item quantity %s or unit price %s',
    (quantity, unitPrice) => {
      expect(() =>
        db
          .prepare(
            'INSERT INTO "OrderItem" (id, orderId, name, quantity, unitPrice) VALUES (?, ?, ?, ?, ?)',
          )
          .run('item', 'order', 'Test Item', quantity, unitPrice),
      ).toThrow(/CHECK/);
    },
  );

  it('rejects items with a nonexistent order', () => {
    expect(() =>
      db
        .prepare(
          'INSERT INTO "OrderItem" (id, orderId, name, quantity, unitPrice) VALUES (?, ?, ?, ?, ?)',
        )
        .run('item', 'missing-order', 'Test Item', 1, 100),
    ).toThrow(/FOREIGN KEY/);
  });

  it('scopes keys to users and permits at most one record per order', () => {
    const insertRecord = db.prepare(
      'INSERT INTO "IdempotencyRecord" (userId, key, requestHash, orderId) VALUES (?, ?, ?, ?)',
    );
    insertRecord.run('agent', 'submission', 'test-request-hash', 'order');
    insertOrder('second-order');

    expect(() =>
      insertRecord.run(
        'agent',
        'submission',
        'test-request-hash',
        'second-order',
      ),
    ).toThrow(/UNIQUE/);
    expect(() =>
      insertRecord.run('agent', 'different-key', 'test-request-hash', 'order'),
    ).toThrow(/UNIQUE/);

    db.prepare(
      'INSERT INTO "User" (id, email, passwordHash) VALUES (?, ?, ?)',
    ).run('other-agent', 'other@example.com', 'test-password-hash');
    insertRecord.run(
      'other-agent',
      'submission',
      'test-request-hash',
      'second-order',
    );
    expect(
      db.prepare('SELECT COUNT(*) AS count FROM "IdempotencyRecord"').get(),
    ).toEqual({ count: 2 });
  });

  it('deletes line items with their order but preserves the idempotency key', () => {
    db.prepare(
      'INSERT INTO "OrderItem" (id, orderId, name, quantity, unitPrice) VALUES (?, ?, ?, ?, ?)',
    ).run('item', 'order', 'Test Item', 1, 1000);
    const insertRecord = db.prepare(
      'INSERT INTO "IdempotencyRecord" (userId, key, requestHash, orderId) VALUES (?, ?, ?, ?)',
    );
    insertRecord.run('agent', 'submission', 'test-request-hash', 'order');

    expect(() => db.exec('DELETE FROM "User" WHERE id = \'agent\'')).toThrow(
      /FOREIGN KEY/,
    );
    db.exec('DELETE FROM "Order" WHERE id = \'order\'');

    expect(
      db.prepare('SELECT COUNT(*) AS count FROM "OrderItem"').get(),
    ).toEqual({ count: 0 });
    expect(
      db.prepare('SELECT key, orderId FROM "IdempotencyRecord"').get(),
    ).toEqual({ key: 'submission', orderId: null });
    expect(() =>
      insertRecord.run('agent', 'submission', 'test-request-hash', null),
    ).toThrow(/UNIQUE/);
  });
});
