import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { compareSync, getRounds } from 'bcryptjs';

it('seeds orders and hashed demo users, and preserves existing data on reruns', () => {
  const directory = mkdtempSync(join(tmpdir(), 'sarh-order-seed-'));
  const databasePath = join(directory, 'seed.db');
  const options = {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    env: {
      ...process.env,
      DATABASE_URL: `file:${databasePath.replaceAll('\\', '/')}`,
    },
    timeout: 60_000,
  };
  let db: DatabaseSync | undefined;

  try {
    execSync('npm run db:migrate', options);
    execSync('npm run db:generate', options);
    execSync('npm run db:seed', options);
    db = new DatabaseSync(databasePath);

    const users = db
      .prepare(
        'SELECT id, email, role, passwordHash FROM "User" ORDER BY email',
      )
      .all();
    expect(users).toHaveLength(2);
    for (const { email, role, password } of [
      { email: 'admin@example.com', role: 'ADMIN', password: 'DemoAdmin123!' },
      { email: 'agent@example.com', role: 'AGENT', password: 'DemoAgent123!' },
    ]) {
      const user = users.find((record) => record.email === email);
      expect(user?.role).toBe(role);
      expect(typeof user?.passwordHash).toBe('string');
      const passwordHash = String(user?.passwordHash);
      expect(passwordHash).not.toBe(password);
      expect(getRounds(passwordHash)).toBe(12);
      expect(compareSync(password, passwordHash)).toBe(true);
      expect(compareSync('incorrect-password', passwordHash)).toBe(false);
    }

    expect(db.prepare('SELECT COUNT(*) AS count FROM "Order"').get()).toEqual({
      count: 50_000,
    });
    expect(
      db.prepare('SELECT COUNT(*) AS count FROM "OrderItem"').get(),
    ).toEqual({ count: 150_000 });
    expect(
      db
        .prepare(
          `
      SELECT COUNT(*) AS count FROM (
        SELECT o.id, o.totalAmount, COUNT(i.id) AS itemCount,
               SUM(i.quantity * i.unitPrice) AS calculatedTotal
        FROM "Order" o LEFT JOIN "OrderItem" i ON i.orderId = o.id
        GROUP BY o.id
        HAVING itemCount NOT BETWEEN 1 AND 5 OR o.totalAmount != calculatedTotal
      )
    `,
        )
        .get(),
    ).toEqual({ count: 0 });
    expect(
      db.prepare('SELECT COUNT(DISTINCT status) AS count FROM "Order"').get(),
    ).toEqual({ count: 4 });
    expect(
      db
        .prepare('SELECT COUNT(DISTINCT createdAt) AS count FROM "Order"')
        .get(),
    ).toEqual({ count: 10_000 });

    db.prepare(
      'INSERT INTO "Order" (id, customerName, customerEmail, totalAmount) VALUES (?, ?, ?, ?)',
    ).run('existing-order', 'Existing Customer', 'existing@example.com', 12345);
    db.prepare(
      'INSERT INTO "OrderItem" (id, orderId, name, quantity, unitPrice) VALUES (?, ?, ?, ?, ?)',
    ).run('existing-item', 'existing-order', 'Existing Item', 1, 12345);
    db.prepare('UPDATE "Order" SET customerName = ? WHERE id = ?').run(
      'Agent Edited',
      'seed-order-00001',
    );

    execSync('npm run db:seed', options);

    expect(
      db
        .prepare(
          'SELECT id, email, role, passwordHash FROM "User" ORDER BY email',
        )
        .all(),
    ).toEqual(users);
    expect(db.prepare('SELECT COUNT(*) AS count FROM "Order"').get()).toEqual({
      count: 50_001,
    });
    expect(
      db.prepare('SELECT COUNT(*) AS count FROM "OrderItem"').get(),
    ).toEqual({ count: 150_001 });
    expect(
      db
        .prepare('SELECT customerName, totalAmount FROM "Order" WHERE id = ?')
        .get('existing-order'),
    ).toEqual({ customerName: 'Existing Customer', totalAmount: 12345 });
    expect(
      db
        .prepare('SELECT customerName FROM "Order" WHERE id = ?')
        .get('seed-order-00001'),
    ).toEqual({ customerName: 'Agent Edited' });
  } finally {
    db?.close();
    rmSync(directory, { recursive: true, force: true });
  }
}, 120_000);
