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
  assert.strictEqual(typeof attendanceService.startWork, 'function', 'attendanceService.startWork missing');
  assert.strictEqual(typeof attendanceService.completeWork, 'function', 'attendanceService.completeWork missing');
  assert.strictEqual(typeof salaryService.generateMonthlySalary, 'function', 'salaryService.generateMonthlySalary missing');

  console.log('Smoke check passed: critical routes and services are present.');
} catch (error) {
  console.error(`Smoke check failed: ${error.message}`);
  process.exit(1);
}
