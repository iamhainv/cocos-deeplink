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
exports.buildTaskiOS = exports.BuildTaskiOS = void 0;
const builder_1 = require("./builder");
const fs = __importStar(require("fs"));
const fse = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const plist = __importStar(require("plist"));
const TAG = '[BuildTaskiOS]';
/**
 * @en
 * Handles all iOS post-build tasks for the Deeplink extension.
 *
 * Responsibilities:
 *  - Copy Pre-deeplink.cmake / Post-deeplink.cmake into native/engine/ios so
 *    Cocos' CMake include chain picks them up.
 *  - Copy the deeplink bridge directory into the built Xcode project's
 *    proj/deeplink folder so the CMake integration can reference it.
 *  - Honour the `enableDeeplink` flag: when false, remove the cmake files from
 *    native/engine/ios instead of copying them; skip plist/entitlements injection.
 *  - IDEMPOTENT injection of a CFBundleURLTypes entry into native/engine/ios/Info.plist
 *    when `urlScheme` is non-empty.
 *  - IDEMPOTENT injection of Associated Domains into the project .entitlements file
 *    when `associatedDomains` is non-empty.
 */
class BuildTaskiOS {
    /**
     * @en
     * Copy Pre-deeplink.cmake and Post-deeplink.cmake into native/engine/ios,
     * and copy the deeplink bridge directory into the built Xcode project.
     *
     * @param option       Typed build-task options from the build panel.
     * @param buildResult  Build result carrying the destination path.
     */
    copyDeeplinkResources(option, buildResult) {
        var _a;
        console.log(TAG, 'copyDeeplinkResources', 'start');
        const deeplinkOption = option.packages[builder_1.PACKAGE_NAME];
        const overwrite = (_a = deeplinkOption.overwriteLibrary) !== null && _a !== void 0 ? _a : true;
        // --- CMake integration files → native/engine/ios ---
        const preCmakeSrc = `${BuildTaskiOS.DeeplinkTemplatePath}/Pre-deeplink.cmake`;
        const postCmakeSrc = `${BuildTaskiOS.DeeplinkTemplatePath}/Post-deeplink.cmake`;
        const preCmakeDest = `${BuildTaskiOS.NativePath}/Pre-deeplink.cmake`;
        const postCmakeDest = `${BuildTaskiOS.NativePath}/Post-deeplink.cmake`;
        fse.copySync(preCmakeSrc, preCmakeDest, { overwrite });
        fse.copySync(postCmakeSrc, postCmakeDest, { overwrite });
        // --- deeplink bridge directory → <buildDest>/proj/deeplink ---
        const deeplinkSrc = `${BuildTaskiOS.DeeplinkTemplatePath}/deeplink`;
        const deeplinkDest = `${buildResult.dest}/proj/deeplink`;
        fse.copySync(deeplinkSrc, deeplinkDest, { recursive: true, overwrite });
        console.log(TAG, 'copyDeeplinkResources', 'end');
    }
    /**
     * @en
     * Remove the CMake integration files from native/engine/ios.
     *
     * Called when enableDeeplink is false so that a previously-enabled build does
     * not leave stale cmake includes in the shared native directory.
     */
    removeDeeplinkCmakeFiles() {
        console.log(TAG, 'removeDeeplinkCmakeFiles', 'start');
        const preCmakeDest = `${BuildTaskiOS.NativePath}/Pre-deeplink.cmake`;
        const postCmakeDest = `${BuildTaskiOS.NativePath}/Post-deeplink.cmake`;
        fse.removeSync(preCmakeDest);
        fse.removeSync(postCmakeDest);
        console.log(TAG, 'removeDeeplinkCmakeFiles', 'end');
    }
    /**
     * @en
     * IDEMPOTENT injection of a CFBundleURLTypes entry for the given URL scheme
     * into native/engine/ios/Info.plist.
     *
     * Logic: parse the plist, find or create the CFBundleURLTypes array, check
     * whether any existing entry already contains the scheme in its
     * CFBundleURLSchemes array.  If not found, append a new entry.  Write back
     * only when a change was made.
     *
     * @param scheme  The URL scheme to register (e.g. "myapp").
     */
    injectUrlScheme(scheme) {
        console.log(TAG, 'injectUrlScheme', `scheme="${scheme}"`);
        const plistPath = BuildTaskiOS.InfoPlistPath;
        if (!fs.existsSync(plistPath)) {
            console.warn(TAG, 'injectUrlScheme', `Info.plist not found at ${plistPath} — urlScheme injection skipped.`);
            return;
        }
        const raw = fs.readFileSync(plistPath, 'utf8');
        const parsed = plist.parse(raw);
        // Ensure CFBundleURLTypes array exists.
        if (!Array.isArray(parsed['CFBundleURLTypes'])) {
            parsed['CFBundleURLTypes'] = [];
        }
        const urlTypes = parsed['CFBundleURLTypes'];
        // Check whether the scheme is already registered in any entry.
        const alreadyPresent = urlTypes.some((entry) => {
            const schemes = entry['CFBundleURLSchemes'];
            return Array.isArray(schemes) && schemes.includes(scheme);
        });
        if (alreadyPresent) {
            console.log(TAG, 'injectUrlScheme', `scheme "${scheme}" already present in CFBundleURLTypes — skipped.`);
            return;
        }
        // Append a new CFBundleURLTypes entry.
        urlTypes.push({
            CFBundleTypeRole: 'Editor',
            CFBundleURLName: 'deeplink',
            CFBundleURLSchemes: [scheme],
        });
        fs.writeFileSync(plistPath, plist.build(parsed), 'utf8');
        console.log(TAG, 'injectUrlScheme', `scheme "${scheme}" injected into ${plistPath}`);
    }
    /**
     * @en
     * IDEMPOTENT injection of Associated Domains into the project's .entitlements file.
     *
     * Locates the first *.entitlements file under native/engine/ios/ via glob,
     * parses it, ensures `com.apple.developer.associated-domains` is an array,
     * and appends any domains not already present.  Writes back only when changed.
     *
     * @param domainsRaw  Comma-separated domain strings (e.g. "applinks:example.com").
     */
    injectAssociatedDomains(domainsRaw) {
        console.log(TAG, 'injectAssociatedDomains', `domains="${domainsRaw}"`);
        const domains = domainsRaw
            .split(',')
            .map((d) => d.trim())
            .filter((d) => d.length > 0);
        if (domains.length === 0) {
            console.log(TAG, 'injectAssociatedDomains', 'no domains after parsing — skipped.');
            return;
        }
        // Locate the entitlements file by scanning the native iOS directory.
        const nativeDir = BuildTaskiOS.NativePath;
        const entitlementFiles = fs.existsSync(nativeDir)
            ? fs.readdirSync(nativeDir)
                .filter((f) => f.endsWith('.entitlements'))
                .map((f) => path.join(nativeDir, f))
            : [];
        if (entitlementFiles.length === 0) {
            console.warn(TAG, 'injectAssociatedDomains', `No .entitlements file found under ${BuildTaskiOS.NativePath} — ` +
                `Associated Domains injection skipped.`);
            return;
        }
        const entitlementsPath = entitlementFiles[0];
        console.log(TAG, 'injectAssociatedDomains', `Using entitlements file: ${entitlementsPath}`);
        const raw = fs.readFileSync(entitlementsPath, 'utf8');
        const parsed = plist.parse(raw);
        const key = 'com.apple.developer.associated-domains';
        if (!Array.isArray(parsed[key])) {
            parsed[key] = [];
        }
        const existing = parsed[key];
        let changed = false;
        for (const domain of domains) {
            if (!existing.includes(domain)) {
                existing.push(domain);
                changed = true;
                console.log(TAG, 'injectAssociatedDomains', `Added "${domain}" to ${key}`);
            }
            else {
                console.log(TAG, 'injectAssociatedDomains', `"${domain}" already present — skipped.`);
            }
        }
        if (changed) {
            fs.writeFileSync(entitlementsPath, plist.build(parsed), 'utf8');
            console.log(TAG, 'injectAssociatedDomains', `Wrote updated entitlements to ${entitlementsPath}`);
        }
    }
    /**
     * @en
     * Entry point called by the build hook for iOS post-build tasks.
     *
     * @param options      Typed build-task options from the build panel.
     * @param buildResult  Build result carrying the destination path.
     */
    executePostBuildTasks(options, buildResult) {
        var _a, _b, _c;
        console.log(TAG, 'executePostBuildTasks', 'start');
        const deeplinkOption = options.packages[builder_1.PACKAGE_NAME];
        const enableDeeplink = (_a = deeplinkOption.enableDeeplink) !== null && _a !== void 0 ? _a : true;
        if (!enableDeeplink) {
            console.log(TAG, 'executePostBuildTasks', 'enableDeeplink is false — removing cmake files, skipping plist/entitlements');
            this.removeDeeplinkCmakeFiles();
            console.log(TAG, 'executePostBuildTasks', 'all tasks done.');
            return;
        }
        this.copyDeeplinkResources(options, buildResult);
        const urlScheme = ((_b = deeplinkOption.urlScheme) !== null && _b !== void 0 ? _b : '').trim();
        if (urlScheme) {
            this.injectUrlScheme(urlScheme);
        }
        else {
            console.log(TAG, 'executePostBuildTasks', 'urlScheme is empty — CFBundleURLTypes injection skipped.');
        }
        const associatedDomains = ((_c = deeplinkOption.associatedDomains) !== null && _c !== void 0 ? _c : '').trim();
        if (associatedDomains) {
            this.injectAssociatedDomains(associatedDomains);
        }
        else {
            console.log(TAG, 'executePostBuildTasks', 'associatedDomains is empty — entitlements injection skipped.');
        }
        console.log(TAG, 'executePostBuildTasks', 'all tasks done.');
    }
}
exports.BuildTaskiOS = BuildTaskiOS;
/** Absolute path to the extension's iOS template directory. */
BuildTaskiOS.DeeplinkTemplatePath = `${__dirname}/../template/ios`;
/** Absolute path to the engine's native iOS directory (shared across builds). */
BuildTaskiOS.NativePath = `${Editor.Project.path}/native/engine/ios`;
/** Path to the native Info.plist managed by the engine. */
BuildTaskiOS.InfoPlistPath = `${BuildTaskiOS.NativePath}/Info.plist`;
/**
 * @en
 * The global instance of the iOS build task.
 * Exported as `buildTaskiOS.ios` to match the shape hooks.ts expects.
 */
exports.buildTaskiOS = {
    ios: new BuildTaskiOS(),
};
