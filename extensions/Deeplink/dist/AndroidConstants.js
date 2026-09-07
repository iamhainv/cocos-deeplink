"use strict";
/*
 Deeplink — Universal Links (Android App Links + iOS Universal Links / Custom URL Schemes)
 extension for Cocos Creator 3.8.8

 MIT License
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.AndroidConstants = void 0;
/**
 * @en
 * Compile-time path constants for the Android build task.
 * All paths are derived from `Editor.Project.path` or `__dirname` at runtime —
 * no hardcoded absolute paths.
 */
class AndroidConstants {
}
exports.AndroidConstants = AndroidConstants;
/**
 * @en The template directory of this extension on disk. */
AndroidConstants.DeeplinkTemplatePath = `${__dirname}/../template/android`;
/**
 * @en The name of the Android native library module. */
AndroidConstants.DeeplinkLibName = 'libdeeplink';
/**
 * @en Source path of the libdeeplink module inside this extension's template. */
AndroidConstants.DeeplinkLibSrcPath = `${AndroidConstants.DeeplinkTemplatePath}/${AndroidConstants.DeeplinkLibName}`;
/**
 * @en
 * Relative destination path (appended to `buildResult.dest`) where the
 * libdeeplink module is copied inside the built project. */
AndroidConstants.DeeplinkLibDestPath = `/proj/${AndroidConstants.DeeplinkLibName}`;
/**
 * @en The filename of the settings.gradle used by the Android project. */
AndroidConstants.SettingGradle = 'settings.gradle';
/**
 * @en
 * The settings.gradle snippet template (adds `include ':libdeeplink'`) stored
 * inside this extension's template directory. */
AndroidConstants.DeeplinkTemplateSettingGradle = `${AndroidConstants.DeeplinkTemplatePath}/${AndroidConstants.SettingGradle}`;
/**
 * @en
 * The build.gradle snippet template that is appended to (or removed from)
 * the built project's build.gradle. */
AndroidConstants.DeeplinkTemplateGradlePath = `${AndroidConstants.DeeplinkTemplatePath}/build.gradle`;
/**
 * @en
 * Placeholder token inside libdeeplink's AndroidManifest.xml that the build
 * task replaces with a generated intent-filter block.
 *
 * CONTRACT (must match the Android agent's AndroidManifest.xml template):
 *   The AndroidManifest.xml inside template/android/libdeeplink/ MUST contain
 *   exactly this string inside the DeeplinkActivity <activity> element.
 *   The build task performs a plain string-replace to substitute it.
 */
AndroidConstants.ManifestIntentFilterPlaceholder = '<!-- DEEPLINK_INTENT_FILTER -->';
/**
 * @en
 * The relative path inside the built project to the libdeeplink AndroidManifest.xml,
 * after the library directory has been copied to {buildDest}/proj/libdeeplink/.
 */
AndroidConstants.DeeplinkManifestRelPath = `${AndroidConstants.DeeplinkLibDestPath}/src/main/AndroidManifest.xml`;
