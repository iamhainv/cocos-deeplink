/*
 Deeplink — Universal Links (Android App Links + iOS Universal Links / Custom URL Schemes)
 extension for Cocos Creator 3.8.8

 MIT License
*/
import { AssetHandlers } from '../@types';

/**
 * @en
 * Texture compression handler for the Deeplink extension.
 *
 * Deeplink does not introduce any custom textures, so this handler is a no-op
 * for all compression tasks.  It exists because `builder.ts` declares
 * `assetHandlers: './asset-handlers'` and the Cocos build pipeline requires
 * the referenced module to export a `compressTextures` function.
 */
export const compressTextures: AssetHandlers.compressTextures = async (tasks) => {
    console.debug(
        `[Deeplink] asset-handlers: compressTextures called with ${tasks.length} task(s) — no-op`,
    );
};
