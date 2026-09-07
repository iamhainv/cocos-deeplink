"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onAfterMake = exports.onBeforeMake = exports.onError = exports.onAfterCompressSettings = exports.onAfterBuild = exports.unload = exports.load = exports.throwError = void 0;
const BuildTaskAndroid_1 = require("./BuildTaskAndroid");
const BuildTaskiOS_1 = require("./BuildTaskiOS");
const PACKAGE_NAME = 'deeplink';
/** @en When true, hook errors abort the build immediately. */
exports.throwError = true;
/** @en Pre-build hook — runs once before compilation begins. */
const load = function () {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`[${PACKAGE_NAME}] Load Deeplink plugin in builder.`);
    });
};
exports.load = load;
/** @en Cleanup hook — runs when the plugin is unloaded. */
const unload = function () {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`[${PACKAGE_NAME}] Unload Deeplink plugin in builder.`);
    });
};
exports.unload = unload;
/**
 * @en
 * Android post-build hook.
 * Injects Gradle snippets, copies the libdeeplink native library, and injects
 * the intent-filter block into the copied AndroidManifest.xml.
 */
const onAfterBuild = function (options, result) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`[${PACKAGE_NAME}] onAfterBuild — platform: ${options.platform}`);
        if (options.platform === 'android') {
            BuildTaskAndroid_1.buildTaskAndroid.android.executePostBuildTasks(options, result);
        }
    });
};
exports.onAfterBuild = onAfterBuild;
/**
 * @en
 * iOS post-build hook.
 * Copies CMake integration files and the deeplink bridge directory into the
 * built iOS project, and injects URL scheme / Associated Domains.
 */
const onAfterCompressSettings = function (options, result) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`[${PACKAGE_NAME}] onAfterCompressSettings — platform: ${options.platform}`);
        if (options.platform === 'ios') {
            BuildTaskiOS_1.buildTaskiOS.ios.executePostBuildTasks(options, result);
        }
    });
};
exports.onAfterCompressSettings = onAfterCompressSettings;
/** @en Fires when the build encounters an error. */
const onError = function (_options, _result) {
    return __awaiter(this, void 0, void 0, function* () {
        console.warn(`[${PACKAGE_NAME}] build error encountered.`);
    });
};
exports.onError = onError;
/** @en Fires before native make step. */
const onBeforeMake = function (root, options) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`[${PACKAGE_NAME}] onBeforeMake: root=${root}`);
    });
};
exports.onBeforeMake = onBeforeMake;
/** @en Fires after native make step. */
const onAfterMake = function (root, options) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`[${PACKAGE_NAME}] onAfterMake: root=${root}`);
    });
};
exports.onAfterMake = onAfterMake;
