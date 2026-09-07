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
exports.compressTextures = void 0;
/**
 * @en
 * Texture compression handler for the Deeplink extension.
 *
 * Deeplink does not introduce any custom textures, so this handler is a no-op
 * for all compression tasks.  It exists because `builder.ts` declares
 * `assetHandlers: './asset-handlers'` and the Cocos build pipeline requires
 * the referenced module to export a `compressTextures` function.
 */
const compressTextures = (tasks) => __awaiter(void 0, void 0, void 0, function* () {
    console.debug(`[Deeplink] asset-handlers: compressTextures called with ${tasks.length} task(s) — no-op`);
});
exports.compressTextures = compressTextures;
