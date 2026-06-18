import { assertZhiliaoKey } from './_activation_core.js';
import { createDesktopActivationHandler } from './_activation_desktop.js';

export default createDesktopActivationHandler({
  assertKey: assertZhiliaoKey,
  rateLimitNamespace: 'activation_zhiliao',
  logLabel: 'ZHILIAO'
});
