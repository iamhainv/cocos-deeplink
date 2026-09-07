/*
 Deeplink — Universal Links (Android App Links + iOS Universal Links / Custom URL Schemes)
 extension for Cocos Creator 3.8.8

 MIT License
*/
import { BuildPlugin } from '../@types';

/** @en Called when the extension is loaded by the editor. */
export const load: BuildPlugin.load = function () {
    console.debug(`${PACKAGE_NAME} load`);
};

/** @en Called when the extension is unloaded by the editor. */
export const unload: BuildPlugin.load = function () {
    console.debug(`${PACKAGE_NAME} unload`);
};

/** @en The package name that identifies this extension across the build pipeline. */
export const PACKAGE_NAME = 'deeplink';

/**
 * @en
 * Build plugin configurations for Android and iOS platforms.
 *
 * Android options generate an intent-filter inside the DeeplinkActivity manifest entry.
 * iOS options inject CFBundleURLTypes into Info.plist and Associated Domains into
 * the project entitlements file.
 */
export const configs: BuildPlugin.Configs = {
    'android': {
        hooks: './hooks',
        doc: 'editor/publish/custom-build-plugin.html',
        options: {
            enableDeeplink: {
                label: `i18n:${PACKAGE_NAME}.enableDeeplink.title`,
                description: `i18n:${PACKAGE_NAME}.enableDeeplink.tip`,
                default: `true`,
                render: {
                    ui: 'ui-checkbox',
                },
            },
            overwriteLibrary: {
                label: `i18n:${PACKAGE_NAME}.overwriteLibrary.title`,
                description: `i18n:${PACKAGE_NAME}.overwriteLibrary.tip`,
                default: `true`,
                render: {
                    ui: 'ui-checkbox',
                },
            },
            scheme: {
                label: `i18n:${PACKAGE_NAME}.scheme.title`,
                description: `i18n:${PACKAGE_NAME}.scheme.tip`,
                default: `https`,
                render: {
                    ui: 'ui-input',
                    attributes: {
                        placeholder: 'https',
                    },
                },
            },
            host: {
                label: `i18n:${PACKAGE_NAME}.host.title`,
                description: `i18n:${PACKAGE_NAME}.host.tip`,
                default: ``,
                render: {
                    ui: 'ui-input',
                    attributes: {
                        placeholder: 'example.com',
                    },
                },
            },
            pathPrefix: {
                label: `i18n:${PACKAGE_NAME}.pathPrefix.title`,
                description: `i18n:${PACKAGE_NAME}.pathPrefix.tip`,
                default: ``,
                render: {
                    ui: 'ui-input',
                    attributes: {
                        placeholder: '/app',
                    },
                },
            },
            autoVerify: {
                label: `i18n:${PACKAGE_NAME}.autoVerify.title`,
                description: `i18n:${PACKAGE_NAME}.autoVerify.tip`,
                default: `true`,
                render: {
                    ui: 'ui-checkbox',
                },
            },
            label: {
                label: `i18n:${PACKAGE_NAME}.label.title`,
                description: `i18n:${PACKAGE_NAME}.label.tip`,
                default: ``,
                render: {
                    ui: 'ui-input',
                    attributes: {
                        placeholder: '',
                    },
                },
            },
        },
    },
    'ios': {
        hooks: './hooks',
        doc: 'editor/publish/custom-build-plugin.html',
        options: {
            enableDeeplink: {
                label: `i18n:${PACKAGE_NAME}.enableDeeplink.title`,
                description: `i18n:${PACKAGE_NAME}.enableDeeplink.tip`,
                default: `true`,
                render: {
                    ui: 'ui-checkbox',
                },
            },
            overwriteLibrary: {
                label: `i18n:${PACKAGE_NAME}.overwriteLibrary.title`,
                description: `i18n:${PACKAGE_NAME}.overwriteLibrary.tip`,
                default: `true`,
                render: {
                    ui: 'ui-checkbox',
                },
            },
            urlScheme: {
                label: `i18n:${PACKAGE_NAME}.urlScheme.title`,
                description: `i18n:${PACKAGE_NAME}.urlScheme.tip`,
                default: ``,
                render: {
                    ui: 'ui-input',
                    attributes: {
                        placeholder: 'myapp',
                    },
                },
            },
            associatedDomains: {
                label: `i18n:${PACKAGE_NAME}.associatedDomains.title`,
                description: `i18n:${PACKAGE_NAME}.associatedDomains.tip`,
                default: ``,
                render: {
                    ui: 'ui-input',
                    attributes: {
                        placeholder: 'applinks:example.com',
                    },
                },
            },
        },
    },
};

/** @en Asset-handler entry-point for the Cocos build pipeline. */
export const assetHandlers: BuildPlugin.AssetHandlers = './asset-handlers';
