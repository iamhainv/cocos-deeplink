/**
 * Compile shim for CI only — NOT an API reference.
 *
 * `cc` is the Cocos Creator engine runtime module, injected by the Creator
 * editor/build pipeline at build and preview time. It is not an npm package
 * and this extension does not (and cannot) depend on it via package.json,
 * so a bare `tsc` invocation — as CI's "Type-check runtime assets" step
 * runs, outside the Creator editor — cannot resolve it without a stand-in
 * declaration like this one.
 *
 * Cocos Creator's own bundled engine typings remain the source of truth for
 * the real `cc` module. This file declares only the members `assets/`
 * actually imports from `cc` / `cc/env`, each typed to match the real
 * engine API just closely enough to compile these specific call sites. It
 * does not attempt to model `cc` completely, must never be widened "to look
 * complete", and must not be used as documentation of the engine API.
 */
declare module 'cc' {
    /** Console-style logger Cocos Creator installs globally at runtime. */
    export function log(...args: any[]): void;

    /** The slice of Cocos Creator's native (`jsb`) bridge namespace this extension touches. */
    export const native: NativeNamespace;

    export interface NativeNamespace {
        /** Native<->JS event bridge Cocos Creator exposes on native (Android/iOS) platforms. */
        jsbBridgeWrapper: JsbBridgeWrapper;
    }

    export interface JsbBridgeWrapper {
        addNativeEventListener(eventName: string, listener: (arg: string) => void): void;
        dispatchEventToNative(eventName: string, arg: string): void;
    }
}
