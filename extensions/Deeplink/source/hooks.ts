/*
 Deeplink — Universal Links (Android App Links + iOS Universal Links / Custom URL Schemes)
 extension for Cocos Creator 3.8.8

 MIT License
*/
import { IBuildTaskOption, BuildHook, IBuildResult } from '../@types';
import { buildTaskAndroid } from './BuildTaskAndroid';
import { buildTaskiOS } from './BuildTaskiOS';

/** @en Package-level options shape coming from the build panel. */
interface IDeeplinkPanelOptions {
    // shared
    enableDeeplink: boolean;
    overwriteLibrary: boolean;
    // android
    scheme: string;
    host: string;
    pathPrefix: string;
    autoVerify: boolean;
    label: string;
    // ios
    urlScheme: string;
    associatedDomains: string;
}

const PACKAGE_NAME = 'deeplink';

/** @en Typed build-task options for the Deeplink extension. */
export interface ITaskOptions extends IBuildTaskOption {
    packages: {
        'deeplink': IDeeplinkPanelOptions;
    };
}

/** @en When true, hook errors abort the build immediately. */
export const throwError: BuildHook.throwError = true;

/** @en Pre-build hook — runs once before compilation begins. */
export const load: BuildHook.load = async function () {
    console.log(`[${PACKAGE_NAME}] Load Deeplink plugin in builder.`);
};

/** @en Cleanup hook — runs when the plugin is unloaded. */
export const unload: BuildHook.unload = async function () {
    console.log(`[${PACKAGE_NAME}] Unload Deeplink plugin in builder.`);
};

/**
 * @en
 * Android post-build hook.
 * Injects Gradle snippets, copies the libdeeplink native library, and injects
 * the intent-filter block into the copied AndroidManifest.xml.
 */
export const onAfterBuild: BuildHook.onAfterBuild = async function (
    options: ITaskOptions,
    result: IBuildResult,
) {
    console.log(`[${PACKAGE_NAME}] onAfterBuild — platform: ${options.platform}`);
    if (options.platform === 'android') {
        buildTaskAndroid.android.executePostBuildTasks(options, result);
    }
};

/**
 * @en
 * iOS post-build hook.
 * Copies CMake integration files and the deeplink bridge directory into the
 * built iOS project, and injects URL scheme / Associated Domains.
 */
export const onAfterCompressSettings: BuildHook.onAfterCompressSettings = async function (
    options: ITaskOptions,
    result: IBuildResult,
) {
    console.log(`[${PACKAGE_NAME}] onAfterCompressSettings — platform: ${options.platform}`);
    if (options.platform === 'ios') {
        buildTaskiOS.ios.executePostBuildTasks(options, result);
    }
};

/** @en Fires when the build encounters an error. */
export const onError: BuildHook.onError = async function (_options, _result) {
    console.warn(`[${PACKAGE_NAME}] build error encountered.`);
};

/** @en Fires before native make step. */
export const onBeforeMake: BuildHook.onBeforeMake = async function (root, options) {
    console.log(`[${PACKAGE_NAME}] onBeforeMake: root=${root}`);
};

/** @en Fires after native make step. */
export const onAfterMake: BuildHook.onAfterMake = async function (root, options) {
    console.log(`[${PACKAGE_NAME}] onAfterMake: root=${root}`);
};
