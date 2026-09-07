/*
 Deeplink — Universal Links (Android App Links + iOS Universal Links / Custom URL Schemes)
 extension for Cocos Creator 3.8.8

 MIT License
*/

/**
 * @en
 * Compile-time path constants for the Android build task.
 * All paths are derived from `Editor.Project.path` or `__dirname` at runtime —
 * no hardcoded absolute paths.
 */
export class AndroidConstants {

    /**
     * @en The template directory of this extension on disk. */
    static readonly DeeplinkTemplatePath = `${__dirname}/../template/android`;

    /**
     * @en The name of the Android native library module. */
    static readonly DeeplinkLibName = 'libdeeplink';

    /**
     * @en Source path of the libdeeplink module inside this extension's template. */
    static readonly DeeplinkLibSrcPath =
        `${AndroidConstants.DeeplinkTemplatePath}/${AndroidConstants.DeeplinkLibName}`;

    /**
     * @en
     * Relative destination path (appended to `buildResult.dest`) where the
     * libdeeplink module is copied inside the built project. */
    static readonly DeeplinkLibDestPath = `/proj/${AndroidConstants.DeeplinkLibName}`;

    /**
     * @en The filename of the settings.gradle used by the Android project. */
    static readonly SettingGradle = 'settings.gradle';

    /**
     * @en
     * The settings.gradle snippet template (adds `include ':libdeeplink'`) stored
     * inside this extension's template directory. */
    static readonly DeeplinkTemplateSettingGradle =
        `${AndroidConstants.DeeplinkTemplatePath}/${AndroidConstants.SettingGradle}`;

    /**
     * @en
     * The build.gradle snippet template that is appended to (or removed from)
     * the built project's build.gradle. */
    static readonly DeeplinkTemplateGradlePath =
        `${AndroidConstants.DeeplinkTemplatePath}/build.gradle`;

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
    static readonly ManifestIntentFilterPlaceholder = '<!-- DEEPLINK_INTENT_FILTER -->';

    /**
     * @en
     * The relative path inside the built project to the libdeeplink AndroidManifest.xml,
     * after the library directory has been copied to {buildDest}/proj/libdeeplink/.
     */
    static readonly DeeplinkManifestRelPath =
        `${AndroidConstants.DeeplinkLibDestPath}/src/main/AndroidManifest.xml`;
}
