"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTaskAndroid = exports.BuildTaskAndroid = void 0;
const builder_1 = require("./builder");
const fs = __importStar(require("fs"));
const fse = __importStar(require("fs-extra"));
const AndroidConstants_1 = require("./AndroidConstants");
const Util_1 = require("./Util");
const TAG = '[BuildTaskAndroid]';
/**
 * @en
 * Handles all post-build tasks required to integrate the Deeplink native library
 * into a Cocos Creator Android build.
 *
 * Responsibilities:
 * - Inject / remove the Deeplink dependency snippet in `build.gradle`.
 * - Inject / remove the `include ':libdeeplink'` line in `settings.gradle`.
 * - Copy `template/android/libdeeplink/` into the built project's `proj/` directory.
 * - Replace the `<!-- DEEPLINK_INTENT_FILTER -->` placeholder in the copied
 *   libdeeplink AndroidManifest.xml with a generated intent-filter element.
 *
 * PLACEHOLDER CONTRACT for the Android agent:
 *   The file `template/android/libdeeplink/src/main/AndroidManifest.xml` MUST
 *   contain exactly the string `<!-- DEEPLINK_INTENT_FILTER -->` (no surrounding
 *   whitespace variation) inside the DeeplinkActivity <activity> element.
 *   This build task performs a plain string-replace on the COPIED file
 *   ({buildDest}/proj/libdeeplink/src/main/AndroidManifest.xml) — the template
 *   source is never modified.
 */
class BuildTaskAndroid {
    /**
     * @en
     * Modify the built project's `build.gradle` and `settings.gradle` to add
     * or remove the Deeplink dependency and module reference.
     *
     * When `enableDeeplink` is true the template snippets are appended (idempotent).
     * When false, any previously-inserted snippets are cleanly removed.
     *
     * @param options      Build task options including Deeplink panel options.
     * @param buildResult  Cocos build result containing the dest path.
     */
    handleGradleFiles(options, buildResult) {
        var _a;
        console.log(TAG, 'handleGradleFiles', `Build path is: ${buildResult.dest}`);
        const deeplinkOption = options.packages[builder_1.PACKAGE_NAME];
        const enableDeeplink = (_a = deeplinkOption.enableDeeplink) !== null && _a !== void 0 ? _a : true;
        // build.gradle: the target lives inside the built project.
        const srcGradle = `${Editor.Project.path}/native/engine/android/app/build.gradle`;
        const destGradle = AndroidConstants_1.AndroidConstants.DeeplinkTemplateGradlePath;
        // settings.gradle: lives at the project root inside the built output.
        const srcSetting = `${buildResult.dest}/proj/${AndroidConstants_1.AndroidConstants.SettingGradle}`;
        const destSetting = AndroidConstants_1.AndroidConstants.DeeplinkTemplateSettingGradle;
        if (enableDeeplink) {
            (0, Util_1.appendDestContentToSrcFileIfNo)(srcGradle, destGradle);
            (0, Util_1.appendDestContentToSrcFileIfNo)(srcSetting, destSetting);
        }
        else {
            (0, Util_1.deleteDestContentInSrcFile)(srcGradle, destGradle);
            (0, Util_1.deleteDestContentInSrcFile)(srcSetting, destSetting);
        }
    }
    /**
     * @en
     * Copy the `libdeeplink` native module from the extension's template directory
     * into the built project's `proj/libdeeplink` directory.
     *
     * Skipped entirely when `enableDeeplink` is false.
     *
     * @param options      Build task options.
     * @param buildResult  Cocos build result containing the dest path.
     */
    copyLibraryDirectory(options, buildResult) {
        console.log(TAG, 'copyLibraryDirectory', `Build path is: ${buildResult.dest}`);
        const deeplinkOption = options.packages[builder_1.PACKAGE_NAME];
        const { enableDeeplink, overwriteLibrary } = deeplinkOption;
        if (!enableDeeplink) {
            console.log(TAG, 'copyLibraryDirectory', 'skipped — enableDeeplink is false');
            return;
        }
        const srcLib = AndroidConstants_1.AndroidConstants.DeeplinkLibSrcPath;
        const destLib = `${buildResult.dest}${AndroidConstants_1.AndroidConstants.DeeplinkLibDestPath}`;
        console.log(TAG, 'copyLibraryDirectory', `from ${srcLib} to ${destLib}`);
        fse.copySync(srcLib, destLib, { recursive: true, overwrite: overwriteLibrary !== null && overwriteLibrary !== void 0 ? overwriteLibrary : true });
        console.log(TAG, 'copyLibraryDirectory', 'done');
    }
    /**
     * @en
     * Build an XML intent-filter string from the Deeplink panel options.
     *
     * The generated block contains:
     *   - <action android:name="android.intent.action.VIEW"/>
     *   - <category android:name="android.intent.category.DEFAULT"/>
     *   - <category android:name="android.intent.category.BROWSABLE"/>
     *   - <data android:scheme="..."/> (plus optional host and pathPrefix attributes)
     *
     * android:autoVerify and android:label are set on the intent-filter element itself
     * when the corresponding options are non-empty/true.
     *
     * @param option  Deeplink panel options.
     * @returns The intent-filter XML string, or null when scheme is empty.
     */
    buildIntentFilterXml(option) {
        var _a, _b, _c, _d, _e;
        const scheme = ((_a = option.scheme) !== null && _a !== void 0 ? _a : '').trim();
        if (!scheme) {
            return null;
        }
        const host = ((_b = option.host) !== null && _b !== void 0 ? _b : '').trim();
        const pathPrefix = ((_c = option.pathPrefix) !== null && _c !== void 0 ? _c : '').trim();
        const autoVerify = (_d = option.autoVerify) !== null && _d !== void 0 ? _d : true;
        const label = ((_e = option.label) !== null && _e !== void 0 ? _e : '').trim();
        // Warn when using http/https without a host — App Links require a host.
        if (!host && (scheme === 'http' || scheme === 'https')) {
            console.warn(TAG, 'buildIntentFilterXml', `[DEEPLINK WARNING] scheme="${scheme}" but host is empty. ` +
                `Android App Links require a host. The intent-filter will be injected ` +
                `but may not work correctly for universal links.`);
        }
        // Build the intent-filter opening tag attributes.
        let filterAttrs = '';
        if (autoVerify) {
            filterAttrs += ' android:autoVerify="true"';
        }
        if (label) {
            filterAttrs += ` android:label="${label}"`;
        }
        // Build the <data> element attributes.
        let dataAttrs = `android:scheme="${scheme}"`;
        if (host) {
            dataAttrs += ` android:host="${host}"`;
        }
        if (pathPrefix) {
            dataAttrs += ` android:pathPrefix="${pathPrefix}"`;
        }
        return [
            `        <intent-filter${filterAttrs}>`,
            `            <action android:name="android.intent.action.VIEW"/>`,
            `            <category android:name="android.intent.category.DEFAULT"/>`,
            `            <category android:name="android.intent.category.BROWSABLE"/>`,
            `            <data ${dataAttrs}/>`,
            `        </intent-filter>`,
        ].join('\n');
    }
    /**
     * @en
     * Replace the `<!-- DEEPLINK_INTENT_FILTER -->` placeholder in the COPIED
     * libdeeplink AndroidManifest.xml with a generated intent-filter element.
     *
     * This method operates on the BUILT output file, never on the template source.
     * The operation is idempotent only in the sense that when the scheme is empty the
     * placeholder is left as-is. Repeated builds with overwriteLibrary=true will
     * re-copy and re-inject from scratch.
     *
     * Injection is skipped when:
     * - enableDeeplink is false (library was not copied).
     * - scheme is empty (nothing to inject).
     *
     * @param options      Build task options.
     * @param buildResult  Cocos build result containing the dest path.
     */
    injectIntentFilter(options, buildResult) {
        console.log(TAG, 'injectIntentFilter', 'start');
        const deeplinkOption = options.packages[builder_1.PACKAGE_NAME];
        if (!deeplinkOption.enableDeeplink) {
            console.log(TAG, 'injectIntentFilter', 'skipped — enableDeeplink is false');
            return;
        }
        const intentFilterXml = this.buildIntentFilterXml(deeplinkOption);
        if (!intentFilterXml) {
            console.log(TAG, 'injectIntentFilter', 'skipped — scheme is empty');
            return;
        }
        const manifestPath = `${buildResult.dest}${AndroidConstants_1.AndroidConstants.DeeplinkManifestRelPath}`;
        if (!fs.existsSync(manifestPath)) {
            console.warn(TAG, 'injectIntentFilter', `AndroidManifest.xml not found at ${manifestPath} — injection skipped.`);
            return;
        }
        const content = fs.readFileSync(manifestPath, 'utf8');
        const placeholder = AndroidConstants_1.AndroidConstants.ManifestIntentFilterPlaceholder;
        if (!content.includes(placeholder)) {
            console.warn(TAG, 'injectIntentFilter', `Placeholder "${placeholder}" not found in ${manifestPath}. ` +
                `Ensure the Android agent's AndroidManifest.xml template contains this exact string.`);
            return;
        }
        const updated = content.replace(placeholder, intentFilterXml);
        fs.writeFileSync(manifestPath, updated, 'utf8');
        console.log(TAG, 'injectIntentFilter', 'intent-filter injected successfully');
    }
    /**
     * @en
     * Run all post-build tasks in sequence.
     *
     * @param options      Build task options.
     * @param buildResult  Cocos build result.
     */
    executePostBuildTasks(options, buildResult) {
        this.handleGradleFiles(options, buildResult);
        this.copyLibraryDirectory(options, buildResult);
        this.injectIntentFilter(options, buildResult);
        console.log(TAG, 'executePostBuildTasks', 'all tasks done.');
    }
}
exports.BuildTaskAndroid = BuildTaskAndroid;
/**
 * @en
 * Singleton build-task instance consumed by `hooks.ts`.
 */
exports.buildTaskAndroid = {
    android: new BuildTaskAndroid(),
};
