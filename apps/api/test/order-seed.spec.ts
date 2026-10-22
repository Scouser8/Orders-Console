import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

it('seeds 50,000 valid orders and reruns without duplicating or overwriting data', () => {
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
