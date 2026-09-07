/**
 * Deeplink Bridge — Cocos Creator 3.8.8
 *
 * Registers a native event listener on the "deeplink" channel using
 * native.jsbBridgeWrapper, multiplexes incoming JSON messages into:
 *   - Pending promise resolutions (request/response by numeric id).
 *   - Named event callbacks (deeplinkReceived, etc.).
 *
 * Wire protocol (fixed — both JS and native sides must agree):
 *
 *   JS → native:
 *     dispatchEventToNative("deeplink", JSON.stringify({ id, method, args }))
 *
 *   native → JS (single string argument):
 *     Response (success):
 *       { "kind": "response", "id": <int>, "success": true, "data": <any> }
 *     Response (failure):
 *       { "kind": "response", "id": <int>, "success": false,
 *         "error": { "code": string, "message": string } }
 *     Event:
 *       { "kind": "event", "name": string, "payload": <any> }
 *
 * Per-call timeout override:
 *   Pass `timeoutMs = 0` to disable the timeout for a specific call.
 *   This is required for `navigateToOpenByDefaultSettings`, because the
 *   response is only delivered after the user returns from the Android system
 *   settings screen (arbitrary duration).
 *
 * Guard: on non-native platforms call() rejects immediately with E_NOT_SUPPORTED.
 */

import { log } from 'cc';
import { native } from 'cc';
import { NATIVE } from 'cc/env';
import { DeeplinkError } from '../Types';

const _TAG = '[Deeplink/Bridge]';

/** Default timeout in milliseconds for a pending native call. */
const DEFAULT_CALL_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Internal wire-protocol types
// ---------------------------------------------------------------------------

interface _WireResponse {
    kind: 'response';
    id: number;
    success: true;
    data: unknown;
}

interface _WireError {
    kind: 'response';
    id: number;
    success: false;
    error: DeeplinkError;
}

interface _WireEvent {
    kind: 'event';
    name: string;
    payload: unknown;
}

type _WireMessage = _WireResponse | _WireError | _WireEvent;

// ---------------------------------------------------------------------------
// Internal pending-call entry
// ---------------------------------------------------------------------------

interface _PendingCall {
    resolve: (data: unknown) => void;
    reject: (err: DeeplinkError) => void;
    /** The active timeout handle, or null when timeout is disabled (0). */
    timer: ReturnType<typeof setTimeout> | null;
}

// ---------------------------------------------------------------------------
// Bridge singleton
// ---------------------------------------------------------------------------

/**
 * Internal bridge between TypeScript and the native Deeplink layer.
 *
 * Only one instance is created (exported as `deeplinkBridge`). Game code
 * should use DeeplinkClient rather than interacting with the bridge directly.
 */
export class Bridge {

    /**
     * Default milliseconds before an unanswered call is rejected with
     * E_TIMEOUT. Individual calls may override this via their `timeoutMs`
     * argument; pass `0` to disable timeout for that call entirely.
     */
    public defaultCallTimeoutMs: number = DEFAULT_CALL_TIMEOUT_MS;

    private _nextId: number = 1;
    private _pending: Map<number, _PendingCall> = new Map();
    private _eventHandlers: Map<string, Set<(payload: unknown) => void>> = new Map();
    private _registered: boolean = false;

    // ------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------

    /**
     * Initialise the bridge: registers the jsbBridgeWrapper listener once.
     * Safe to call on non-native platforms — the listener registration is
     * guarded by the NATIVE constant.
     */
    public init(): this {
        if (this._registered) {
            return this;
        }
        this._registered = true;

        if (NATIVE) {
            (native as any).jsbBridgeWrapper.addNativeEventListener('deeplink', (payload: string) => {
                this._onNativeMessage(payload);
            });
            log(_TAG, 'native listener registered on channel "deeplink"');
        } else {
            log(_TAG, 'non-native platform — listener registration skipped');
        }

        return this;
    }

    // ------------------------------------------------------------------
    // Public call API
    // ------------------------------------------------------------------

    /**
     * Send a request to the native Deeplink layer and return a Promise that
     * resolves with the response data or rejects with a DeeplinkError.
     *
     * @param method     camelCase method name matching the native implementation.
     * @param args       Argument object; serialised as JSON.
     * @param timeoutMs  Per-call timeout override in milliseconds.
     *                   Pass `0` to disable the timeout for this call — required
     *                   for calls where the user navigates to a system settings
     *                   screen and may take an arbitrary amount of time to return.
     *                   Omit to use `defaultCallTimeoutMs`.
     *
     * @throws DeeplinkError with code `E_NOT_SUPPORTED` on non-native platforms.
     * @throws DeeplinkError with code `E_TIMEOUT` if no response arrives within
     *         the effective timeout (skipped when `timeoutMs` is 0).
     */
    public call<T>(method: string, args: object = {}, timeoutMs?: number): Promise<T> {
        if (!NATIVE || !(native as any).jsbBridgeWrapper) {
            return Promise.reject<T>({
                code: 'E_NOT_SUPPORTED',
                message: 'Deeplink is only available on native iOS/Android',
            } as DeeplinkError);
        }

        const effectiveTimeout = timeoutMs !== undefined ? timeoutMs : this.defaultCallTimeoutMs;
        const id = this._nextId++;
        const envelope = JSON.stringify({ id, method, args });

        return new Promise<T>((resolve, reject) => {
            let timer: ReturnType<typeof setTimeout> | null = null;

            if (effectiveTimeout > 0) {
                timer = setTimeout(() => {
                    this._pending.delete(id);
                    reject({
                        code: 'E_TIMEOUT',
                        message: `Native call "${method}" timed out after ${effectiveTimeout}ms`,
                    } as DeeplinkError);
                }, effectiveTimeout);
            }

            this._pending.set(id, {
                resolve: (data) => resolve(data as T),
                reject,
                timer,
            });

            log(_TAG, `call id=${id} method=${method} timeoutMs=${effectiveTimeout}`);
            (native as any).jsbBridgeWrapper.dispatchEventToNative('deeplink', envelope);
        });
    }

    // ------------------------------------------------------------------
    // Event API (used internally by DeeplinkClient)
    // ------------------------------------------------------------------

    /**
     * Subscribe to a named event emitted by the native side.
     *
     * @param name     Event name (e.g., 'deeplinkReceived').
     * @param handler  Callback receiving the typed payload.
     */
    public on(name: string, handler: (payload: unknown) => void): void {
        let set = this._eventHandlers.get(name);
        if (!set) {
            set = new Set();
            this._eventHandlers.set(name, set);
        }
        set.add(handler);
    }

    /**
     * Unsubscribe a previously registered event handler.
     *
     * @param name     Event name.
     * @param handler  The exact handler reference passed to `on()`.
     */
    public off(name: string, handler: (payload: unknown) => void): void {
        const set = this._eventHandlers.get(name);
        if (set) {
            set.delete(handler);
        }
    }

    // ------------------------------------------------------------------
    // Private message routing
    // ------------------------------------------------------------------

    private _onNativeMessage(raw: string): void {
        let msg: _WireMessage;
        try {
            msg = JSON.parse(raw) as _WireMessage;
        } catch (e) {
            log(_TAG, 'failed to parse native message:', raw);
            return;
        }

        if (msg.kind === 'response') {
            this._handleResponse(msg as _WireResponse | _WireError);
        } else if (msg.kind === 'event') {
            this._handleEvent(msg as _WireEvent);
        } else {
            log(_TAG, 'unknown message kind:', (msg as any).kind);
        }
    }

    private _handleResponse(msg: _WireResponse | _WireError): void {
        const entry = this._pending.get(msg.id);
        if (!entry) {
            log(_TAG, `no pending call for id=${msg.id}`);
            return;
        }

        if (entry.timer !== null) {
            clearTimeout(entry.timer);
        }
        this._pending.delete(msg.id);

        if (msg.success) {
            entry.resolve((msg as _WireResponse).data);
        } else {
            entry.reject((msg as _WireError).error);
        }
    }

    private _handleEvent(msg: _WireEvent): void {
        log(_TAG, `event "${msg.name}"`);
        const handlers = this._eventHandlers.get(msg.name);
        if (handlers) {
            handlers.forEach((h) => {
                try {
                    h(msg.payload);
                } catch (err) {
                    log(_TAG, `error in handler for event "${msg.name}":`, err);
                }
            });
        }
    }
}

/** Singleton bridge instance. Initialised on module load. */
export const deeplinkBridge = new Bridge().init();
