/*
 Deeplink — Universal Links (Android App Links + iOS Universal Links / Custom URL Schemes)
 extension for Cocos Creator 3.8.8

 MIT License
*/
import { IBuildResult } from '../@types';
import { PACKAGE_NAME } from './builder';
import { DeeplinkOption } from './DeeplinkOptions';
import * as fs from 'fs';
import * as fse from 'fs-extra';
import * as path from 'path';
import * as plist from 'plist';
import { ITaskOptions } from './hooks';

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
export class BuildTaskiOS {

    /** Absolute path to the extension's iOS template directory. */
    static readonly DeeplinkTemplatePath = `${__dirname}/../template/ios`;

    /** Absolute path to the engine's native iOS directory (shared across builds). */
    static readonly NativePath = `${Editor.Project.path}/native/engine/ios`;

    /** Path to the native Info.plist managed by the engine. */
    static readonly InfoPlistPath = `${BuildTaskiOS.NativePath}/Info.plist`;

    /**
     * @en
     * Copy Pre-deeplink.cmake and Post-deeplink.cmake into native/engine/ios,
     * and copy the deeplink bridge directory into the built Xcode project.
     *
     * @param option       Typed build-task options from the build panel.
     * @param buildResult  Build result carrying the destination path.
     */
    private copyDeeplinkResources(option: ITaskOptions, buildResult: IBuildResult): void {
        console.log(TAG, 'copyDeeplinkResources', 'start');

        const deeplinkOption = option.packages[PACKAGE_NAME] as DeeplinkOption;
        const overwrite = deeplinkOption.overwriteLibrary ?? true;

        // --- CMake integration files → native/engine/ios ---
        const preCmakeSrc   = `${BuildTaskiOS.DeeplinkTemplatePath}/Pre-deeplink.cmake`;
        const postCmakeSrc  = `${BuildTaskiOS.DeeplinkTemplatePath}/Post-deeplink.cmake`;
        const preCmakeDest  = `${BuildTaskiOS.NativePath}/Pre-deeplink.cmake`;
        const postCmakeDest = `${BuildTaskiOS.NativePath}/Post-deeplink.cmake`;

        fse.copySync(preCmakeSrc,  preCmakeDest,  { overwrite });
        fse.copySync(postCmakeSrc, postCmakeDest, { overwrite });

        // --- deeplink bridge directory → <buildDest>/proj/deeplink ---
        const deeplinkSrc  = `${BuildTaskiOS.DeeplinkTemplatePath}/deeplink`;
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
    private removeDeeplinkCmakeFiles(): void {
        console.log(TAG, 'removeDeeplinkCmakeFiles', 'start');

        const preCmakeDest  = `${BuildTaskiOS.NativePath}/Pre-deeplink.cmake`;
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
    private injectUrlScheme(scheme: string): void {
        console.log(TAG, 'injectUrlScheme', `scheme="${scheme}"`);

        const plistPath = BuildTaskiOS.InfoPlistPath;
        if (!fs.existsSync(plistPath)) {
            console.warn(TAG, 'injectUrlScheme',
                `Info.plist not found at ${plistPath} — urlScheme injection skipped.`);
            return;
        }

        const raw = fs.readFileSync(plistPath, 'utf8');
        const parsed = plist.parse(raw) as Record<string, unknown>;

        // Ensure CFBundleURLTypes array exists.
        if (!Array.isArray(parsed['CFBundleURLTypes'])) {
            parsed['CFBundleURLTypes'] = [];
        }
        const urlTypes = parsed['CFBundleURLTypes'] as Array<Record<string, unknown>>;

        // Check whether the scheme is already registered in any entry.
        const alreadyPresent = urlTypes.some((entry) => {
            const schemes = entry['CFBundleURLSchemes'];
            return Array.isArray(schemes) && (schemes as string[]).includes(scheme);
        });

        if (alreadyPresent) {
            console.log(TAG, 'injectUrlScheme',
                `scheme "${scheme}" already present in CFBundleURLTypes — skipped.`);
            return;
        }

        // Append a new CFBundleURLTypes entry.
        urlTypes.push({
            CFBundleTypeRole: 'Editor',
            CFBundleURLName: 'deeplink',
            CFBundleURLSchemes: [scheme],
        });

        fs.writeFileSync(plistPath, plist.build(parsed), 'utf8');
        console.log(TAG, 'injectUrlScheme',
            `scheme "${scheme}" injected into ${plistPath}`);
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
    private injectAssociatedDomains(domainsRaw: string): void {
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
            console.warn(TAG, 'injectAssociatedDomains',
                `No .entitlements file found under ${BuildTaskiOS.NativePath} — ` +
                `Associated Domains injection skipped.`);
            return;
        }

        const entitlementsPath = entitlementFiles[0];
        console.log(TAG, 'injectAssociatedDomains',
            `Using entitlements file: ${entitlementsPath}`);

        const raw = fs.readFileSync(entitlementsPath, 'utf8');
        const parsed = plist.parse(raw) as Record<string, unknown>;

        const key = 'com.apple.developer.associated-domains';
        if (!Array.isArray(parsed[key])) {
            parsed[key] = [];
        }
        const existing = parsed[key] as string[];

        let changed = false;
        for (const domain of domains) {
            if (!existing.includes(domain)) {
                existing.push(domain);
                changed = true;
                console.log(TAG, 'injectAssociatedDomains',
                    `Added "${domain}" to ${key}`);
            } else {
                console.log(TAG, 'injectAssociatedDomains',
                    `"${domain}" already present — skipped.`);
            }
        }

        if (changed) {
            fs.writeFileSync(entitlementsPath, plist.build(parsed), 'utf8');
            console.log(TAG, 'injectAssociatedDomains',
                `Wrote updated entitlements to ${entitlementsPath}`);
        }
    }

    /**
     * @en
     * Entry point called by the build hook for iOS post-build tasks.
     *
     * @param options      Typed build-task options from the build panel.
     * @param buildResult  Build result carrying the destination path.
     */
    executePostBuildTasks(options: ITaskOptions, buildResult: IBuildResult): void {
        console.log(TAG, 'executePostBuildTasks', 'start');

        const deeplinkOption = options.packages[PACKAGE_NAME] as DeeplinkOption;
        const enableDeeplink = deeplinkOption.enableDeeplink ?? true;

        if (!enableDeeplink) {
            console.log(TAG, 'executePostBuildTasks',
                'enableDeeplink is false — removing cmake files, skipping plist/entitlements');
            this.removeDeeplinkCmakeFiles();
            console.log(TAG, 'executePostBuildTasks', 'all tasks done.');
            return;
        }

        this.copyDeeplinkResources(options, buildResult);

        const urlScheme = (deeplinkOption.urlScheme ?? '').trim();
        if (urlScheme) {
            this.injectUrlScheme(urlScheme);
        } else {
            console.log(TAG, 'executePostBuildTasks',
                'urlScheme is empty — CFBundleURLTypes injection skipped.');
        }

        const associatedDomains = (deeplinkOption.associatedDomains ?? '').trim();
        if (associatedDomains) {
            this.injectAssociatedDomains(associatedDomains);
        } else {
            console.log(TAG, 'executePostBuildTasks',
                'associatedDomains is empty — entitlements injection skipped.');
        }

        console.log(TAG, 'executePostBuildTasks', 'all tasks done.');
    }
}

/**
 * @en
 * The global instance of the iOS build task.
 * Exported as `buildTaskiOS.ios` to match the shape hooks.ts expects.
 */
export const buildTaskiOS = {
    ios: new BuildTaskiOS(),
};
