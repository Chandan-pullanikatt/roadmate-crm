const assert = require('assert');

const authRouter = require('../routes/auth');
const usersRouter = require('../routes/users');
const leadsRouter = require('../routes/leads');
const attendanceRouter = require('../routes/attendance');
const leaveRouter = require('../routes/leave');
const dashboardRouter = require('../routes/dashboard');
const uploadRouter = require('../routes/upload');
const configRouter = require('../routes/config');
const leadService = require('../services/leadService');
const attendanceService = require('../services/attendanceService');
const salaryService = require('../services/salaryService');

const getRoutePaths = (router) =>
  router.stack
    .filter((layer) => layer.route)
    .flatMap((layer) =>
      Object.keys(layer.route.methods).map((method) => `${method.toUpperCase()} ${layer.route.path}`)
    );

const expectRoute = (router, route) => {
  const paths = getRoutePaths(router);
  assert(paths.includes(route), `Missing route: ${route}`);
};

try {
  expectRoute(authRouter, 'POST /login');
  expectRoute(usersRouter, 'GET /');
  expectRoute(usersRouter, 'POST /create-executive');
  expectRoute(leadsRouter, 'GET /queue');
  expectRoute(leadsRouter, 'POST /bulk');
  expectRoute(leadsRouter, 'POST /:id/transition');
  expectRoute(leadsRouter, 'GET /escalations/pending');
  expectRoute(leadsRouter, 'POST /:id/escalation/decision');
  expectRoute(attendanceRouter, 'POST /start');
  expectRoute(attendanceRouter, 'POST /complete');
  expectRoute(leaveRouter, 'POST /request');
  expectRoute(leaveRouter, 'PUT /:id/approve');
  expectRoute(dashboardRouter, 'GET /reports/salary');
  expectRoute(dashboardRouter, 'POST /salary/generate');
  expectRoute(uploadRouter, 'POST /presign');
  expectRoute(configRouter, 'POST /');

  assert.strictEqual(typeof leadService.getWorkflowData, 'function', 'leadService.getWorkflowData missing');
  assert.strictEqual(typeof leadService.transition, 'function', 'leadService.transition missing');
  assert.strictEqual(typeof leadService.decideEscalation, 'function', 'leadService.decideEscalation missing');
  assert.strictEqual(typeof attendanceService.startWork, 'function', 'attendanceService.startWork missing');
  assert.strictEqual(typeof attendanceService.completeWork, 'function', 'attendanceService.completeWork missing');
  assert.strictEqual(typeof salaryService.generateMonthlySalary, 'function', 'salaryService.generateMonthlySalary missing');

  // The bulk import maps a sheet's status text twice -- once in the browser to
  // preview and warn, once on the server which has the final say. They have
  // drifted three times, and every time it showed up as "everything imported as a
  // New lead" rather than as an error, so the two copies are compared here.
  {
    const fs = require('fs');
    const path = require('path');
    const keysOf = (file) => {
      const text = fs.readFileSync(file, 'utf8');
      const start = text.indexOf('statusMap = {');
      assert(start !== -1, `No statusMap found in ${file}`);
      const body = text.slice(start, text.indexOf('};', start));
      return new Set([...body.matchAll(/'([^']+)'\s*:/g)].map(m => m[1]));
    };
    const server = keysOf(path.join(__dirname, '..', 'routes', 'leads.js'));
    const client = keysOf(path.join(__dirname, '..', '..', '..', 'client', 'src', 'components', 'BulkUploadModal.jsx'));
    const missing = [...server].filter(k => !client.has(k));
    const extra = [...client].filter(k => !server.has(k));
    assert(
      !missing.length && !extra.length,
      `Bulk import statusMap has drifted. Missing from client: [${missing}]. Only in client: [${extra}].`
    );
  }

  console.log('Smoke check passed: critical routes and services are present.');
} catch (error) {
  console.error(`Smoke check failed: ${error.message}`);
  process.exit(1);
}
