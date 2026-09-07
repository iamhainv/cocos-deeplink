/**
 * Hand-written ambient declarations for the small slice of the Cocos
 * Creator Editor / Builder extension API that this extension's `source/`
 * actually uses.
 *
 * This directory previously vendored the Cocos Creator editor's full
 * `@types/` typings tree (~750 files / ~3.9 MB): the global `Editor`
 * namespace plus the internal "builder" plugin API. Those files carried no
 * license or copyright notice, and this extension is published under its
 * own MIT license — vendoring them would assert terms over code we do not
 * own. This file replaces that entire tree with an original, minimal
 * declaration.
 *
 * It models only what `source/` actually imports or references:
 *  - the global `Editor.Project.path` (used by `AndroidConstants.ts` /
 *    `BuildTaskiOS.ts` to locate the native project);
 *  - `IBuildResult` / `IBuildTaskOption`, the parameters the Cocos build
 *    pipeline passes into build hooks (`hooks.ts`, `BuildTask*.ts`);
 *  - `BuildHook`, the function signatures a builder plugin's `hooks.ts`
 *    may export;
 *  - `BuildPlugin`, the registration surface `builder.ts` exports
 *    (`configs`, `assetHandlers`, `load`);
 *  - `AssetHandlers`, the signature of the no-op texture-compress handler
 *    `asset-handlers.ts` exports.
 *
 * It does not attempt to model the full Cocos Creator Editor/Builder API —
 * only the fields this extension's own code reads. Do not widen this file
 * to "look complete"; add a member only when `source/` actually starts
 * using it.
 *
 * Because this file has top-level `export`s, TypeScript treats it as a
 * module, so the ambient `Editor` global below is wrapped in
 * `declare global` — it becomes visible to every file in the program once
 * any `source/` file imports from this module (see `hooks.ts`,
 * `builder.ts`, `asset-handlers.ts`, `BuildTaskAndroid.ts`,
 * `BuildTaskiOS.ts`).
 */

declare global {
    namespace Editor {
        namespace Project {
            /** Absolute path to the currently open Creator project. */
            const path: string;
        }
    }
}

/** The build result object the Cocos build pipeline passes into post-build hooks. */
export interface IBuildResult {
    /** Absolute path to the built project's output directory. */
    dest: string;
}

/**
 * The subset of the build task's options object this extension reads. The
 * real object carries many more build-panel fields (platform target,
 * bundling, compression, scenes, …) that this extension never touches.
 */
export interface IBuildTaskOption {
    /** Target platform id, e.g. 'android' | 'ios'. */
    platform: string;
    /** Per-package options keyed by package name, as configured in `builder.ts`. */
    packages?: Record<string, any>;
}

/** One entry of a build-panel option schema (see `builder.ts`'s `configs`). */
export interface IBuildPluginOption {
    label?: string;
    description?: string;
    default?: any;
    render?: {
        ui: string;
        attributes?: Record<string, string | boolean | number>;
    };
    verifyRules?: string[];
}

/** One platform's build-plugin registration (see `builder.ts`'s `configs`). */
export interface IBuildPluginConfig {
    hooks?: string;
    doc?: string;
    options?: Record<string, IBuildPluginOption>;
}

/** Build-hook function signatures a builder plugin's `hooks.ts` may export. */
export namespace BuildHook {
    export type throwError = boolean;
    export type load = () => Promise<void> | void;
    export type unload = () => Promise<void> | void;
    export type onError = (options: IBuildTaskOption, result: IBuildResult) => Promise<void> | void;
    export type onBeforeBuild = (options: IBuildTaskOption, result: IBuildResult) => Promise<void> | void;
    export type onAfterBuild = (options: IBuildTaskOption, result: IBuildResult) => Promise<void> | void;
    export type onAfterCompressSettings = (options: IBuildTaskOption, result: IBuildResult) => Promise<void> | void;
    export type onBeforeMake = (root: string, options: IBuildTaskOption) => Promise<void> | void;
    export type onAfterMake = (root: string, options: IBuildTaskOption) => Promise<void> | void;
}

/** Build-plugin registration surface exported from `builder.ts`. */
export namespace BuildPlugin {
    export type Configs = Record<string, IBuildPluginConfig>;
    export type AssetHandlers = string;
    export type load = () => Promise<void> | void;
}

/** Asset-handler function signatures exported from `asset-handlers.ts`. */
export namespace AssetHandlers {
    export type compressTextures = (
        tasks: { src: string; dest: string; quality: number | string; format: string }[],
    ) => Promise<void>;
}
