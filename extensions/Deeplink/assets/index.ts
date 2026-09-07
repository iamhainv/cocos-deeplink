/**
 * Deeplink extension — public barrel export.
 *
 * Import via the extension alias:
 *   import { deeplink, DeeplinkUrl, DeeplinkError } from 'db://deeplink/index';
 */

export { deeplink, DeeplinkClient } from './DeeplinkClient';
export type { DeeplinkUrl, DeeplinkError } from './Types';
