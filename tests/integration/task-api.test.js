import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app.js';
import { createTestDatabase } from '../helpers/test-db.js';

describe('Task API Integration Tests', () => {
  let server;
  let baseUrl;
  let db;

  before(async () => {
    db = createTestDatabase();
    server = createApp({ db });
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  });

  describe('GET /api/tasks', () => {
    it('should return empty list when no tasks exist', async () => {
      const res = await fetch(`${baseUrl}/api/tasks?date=2026-11-02`);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type')?.includes('application/json'), true);
      const data = await res.json();
      assert.deepEqual(data, []);
    });
  });

  describe('POST /api/tasks', () => {
    it('should create task and return 201', async () => {
      const res = await fetch(`${baseUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Patch OpenSSL vulnerability',
          priority: 'Alta',
          isFocus: true,
          date: '2026-11-02'
        })
      });

      assert.equal(res.status, 201);
      const data = await res.json();
      assert.ok(data.task);
      assert.ok(data.task.id);
      assert.equal(data.task.title, 'Patch OpenSSL vulnerability');
      assert.equal(data.task.priority, 'Alta');
      assert.equal(data.task.status, 'Pendiente');
      assert.equal(data.task.isFocus, true);
      assert.equal(data.task.date, '2026-11-02');
    });

    it('should return 400 Bad Request when title is missing', async () => {
      const res = await fetch(`${baseUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priority: 'Alta'
        })
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.ok(data.error);
    });

    it('should return 400 Bad Request when priority is invalid', async () => {
      const res = await fetch(`${baseUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Valid title',
          priority: 'Critica'
        })
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('priority'));
    });
  });

  describe('Filtering and Sorting via GET /api/tasks', () => {
    it('should return tasks sorted with Focus first and filtered by query params', async () => {
      // Create additional tasks
      await fetch(`${baseUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Low priority maintenance',
          priority: 'Baja',
          date: '2026-11-02'
        })
      });

      await fetch(`${baseUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Medium priority backup',
          priority: 'Media',
          date: '2026-11-02'
        })
      });

      // GET all tasks for date
      const resAll = await fetch(`${baseUrl}/api/tasks?date=2026-11-02`);
      assert.equal(resAll.status, 200);
      const all = await resAll.json();
      assert.equal(all.length, 3);
      // Focus task should be first
      assert.equal(all[0].isFocus, true);
      assert.equal(all[0].title, 'Patch OpenSSL vulnerability');

      // Filter by priority
      const resBaja = await fetch(`${baseUrl}/api/tasks?date=2026-11-02&priority=Baja`);
      const bajaTasks = await resBaja.json();
      assert.equal(bajaTasks.length, 1);
      assert.equal(bajaTasks[0].priority, 'Baja');
    });
  });

  describe('PATCH /api/tasks/:id', () => {
    it('should update task partially and return 200', async () => {
      const createRes = await fetch(`${baseUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Task to update',
          priority: 'Media',
          date: '2026-11-02'
        })
      });
      const created = (await createRes.json()).task;

      const patchRes = await fetch(`${baseUrl}/api/tasks/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'En Progreso',
          isFocus: true
        })
      });

      assert.equal(patchRes.status, 200);
      const updated = (await patchRes.json()).task;
      assert.equal(updated.id, created.id);
      assert.equal(updated.status, 'En Progreso');
      assert.equal(updated.isFocus, true);
      assert.equal(updated.priority, 'Media');
    });

    it('should return 404 Not Found when patching non-existent task', async () => {
      const res = await fetch(`${baseUrl}/api/tasks/non-existent-id`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'Completada'
        })
      });

      assert.equal(res.status, 404);
      const data = await res.json();
      assert.ok(data.error);
    });

    it('should return 400 Bad Request on invalid patch body', async () => {
      const createRes = await fetch(`${baseUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Task for invalid patch',
          priority: 'Baja',
          date: '2026-11-02'
        })
      });
      const created = (await createRes.json()).task;

      const res = await fetch(`${baseUrl}/api/tasks/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priority: 'InvalidPriority'
        })
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.ok(data.error);
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    it('should delete task and return 204 No Content', async () => {
      const createRes = await fetch(`${baseUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Temporary Task',
          priority: 'Baja',
          date: '2026-11-02'
        })
      });
      const created = (await createRes.json()).task;

      const deleteRes = await fetch(`${baseUrl}/api/tasks/${created.id}`, {
        method: 'DELETE'
      });
      assert.equal(deleteRes.status, 204);

      // Verify deletion
      const checkRes = await fetch(`${baseUrl}/api/tasks?date=2026-11-02`);
      const tasks = await checkRes.json();
      assert.ok(!tasks.some((t) => t.id === created.id));
    });

    it('should return 404 Not Found when deleting non-existent task', async () => {
      const res = await fetch(`${baseUrl}/api/tasks/missing-task-id`, {
        method: 'DELETE'
      });
      assert.equal(res.status, 404);
      const data = await res.json();
      assert.ok(data.error);
    });
  });
});
