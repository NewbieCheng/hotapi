import { assertZhixiaoKey } from './_activation_core.js';
import { createDesktopActivationHandler } from './_activation_desktop.js';

export default createDesktopActivationHandler({
  assertKey: assertZhixiaoKey,
  rateLimitNamespace: 'activation_zhixiao',
  logLabel: 'ZHIXIAO'
});
