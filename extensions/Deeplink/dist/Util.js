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
exports.deleteDestContentInSrcFile = deleteDestContentInSrcFile;
exports.appendDestContentToSrcFileIfNo = appendDestContentToSrcFileIfNo;
exports.insertDestToSrcBehindKey = insertDestToSrcBehindKey;
exports.deleteDestToSrcBehindKey = deleteDestToSrcBehindKey;
/*
 Deeplink — Universal Links (Android App Links + iOS Universal Links / Custom URL Schemes)
 extension for Cocos Creator 3.8.8

 MIT License
*/
const fs = __importStar(require("fs"));
const TAG = '[Util]';
/**
 * @en
 * Delete the exact byte-for-byte content of `destPath` from the file at
 * `srcPath`.  If the content is not present, the file is left unchanged.
 *
 * @param srcPath  Absolute path of the file to modify in-place.
 * @param destPath Absolute path of the template whose content is to be removed.
 */
function deleteDestContentInSrcFile(srcPath, destPath) {
    let srcContent = fs.readFileSync(srcPath, { encoding: 'binary' });
    const template = fs.readFileSync(destPath, { encoding: 'binary' });
    const pos = srcContent.indexOf(template);
    if (pos >= 0) {
        srcContent = srcContent.replace(template, '');
        fs.writeFileSync(srcPath, srcContent);
    }
}
/**
 * @en
 * Append the content of `destPath` to the file at `srcPath`, but only if
 * `srcPath` does not already contain that content (idempotent insert).
 *
 * @param srcPath  Absolute path of the file to extend.
 * @param destPath Absolute path of the template to append.
 */
function appendDestContentToSrcFileIfNo(srcPath, destPath) {
    const srcContent = fs.readFileSync(srcPath, { encoding: 'binary' });
    const template = fs.readFileSync(destPath, { encoding: 'binary' });
    const pos = srcContent.indexOf(template);
    if (pos < 0) {
        fs.writeFileSync(srcPath, srcContent + template);
    }
}
/**
 * @en
 * Insert the content of `destPath` into the file at `srcPath` immediately
 * after the first occurrence of the key string from `keyPath`.  If the content
 * is already present the file is left unchanged.
 *
 * @param srcPath   Absolute path of the file to modify in-place.
 * @param destPath  Absolute path of the snippet to insert.
 * @param keyPath   Absolute path of the key snippet that locates the insertion point.
 */
function insertDestToSrcBehindKey(srcPath, destPath, keyPath) {
    const srcContent = fs.readFileSync(srcPath, { encoding: 'binary' });
    const keyContent = fs.readFileSync(keyPath, { encoding: 'binary' });
    const destContent = fs.readFileSync(destPath, { encoding: 'binary' });
    console.log(TAG, 'insertDestToSrcBehindKey', `srcPath: ${srcPath}, destPath: ${destPath}, keyPath: ${keyPath}`);
    if (srcContent.indexOf(destContent) >= 0) {
        return; // already inserted
    }
    const insertPos = srcContent.indexOf(keyContent);
    if (insertPos < 0) {
        console.log(TAG, 'insertDestToSrcBehindKey', 'Could not locate key content — insert skipped.', keyContent);
        return;
    }
    const after = insertPos + keyContent.length;
    const result = srcContent.slice(0, after) + destContent + srcContent.slice(after);
    fs.writeFileSync(srcPath, result);
}
/**
 * @en
 * Delete the content of `destPath` from `srcPath` (key-located variant).
 *
 * @param srcPath  Absolute path of the file to modify in-place.
 * @param destPath Absolute path of the snippet to remove.
 */
function deleteDestToSrcBehindKey(srcPath, destPath) {
    const srcContent = fs.readFileSync(srcPath, { encoding: 'binary' });
    const destContent = fs.readFileSync(destPath, { encoding: 'binary' });
    const pos = srcContent.indexOf(destContent);
    if (pos >= 0) {
        const result = srcContent.replace(destContent, '');
        fs.writeFileSync(srcPath, result);
    }
}
