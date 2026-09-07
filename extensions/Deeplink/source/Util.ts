/*
 Deeplink — Universal Links (Android App Links + iOS Universal Links / Custom URL Schemes)
 extension for Cocos Creator 3.8.8

 MIT License
*/
import * as fs from 'fs';

const TAG = '[Util]';

/**
 * @en
 * Delete the exact byte-for-byte content of `destPath` from the file at
 * `srcPath`.  If the content is not present, the file is left unchanged.
 *
 * @param srcPath  Absolute path of the file to modify in-place.
 * @param destPath Absolute path of the template whose content is to be removed.
 */
export function deleteDestContentInSrcFile(srcPath: string, destPath: string): void {
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
export function appendDestContentToSrcFileIfNo(srcPath: string, destPath: string): void {
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
export function insertDestToSrcBehindKey(
    srcPath: string,
    destPath: string,
    keyPath: string,
): void {
    const srcContent = fs.readFileSync(srcPath, { encoding: 'binary' });
    const keyContent = fs.readFileSync(keyPath, { encoding: 'binary' });
    const destContent = fs.readFileSync(destPath, { encoding: 'binary' });

    console.log(TAG, 'insertDestToSrcBehindKey',
        `srcPath: ${srcPath}, destPath: ${destPath}, keyPath: ${keyPath}`);

    if (srcContent.indexOf(destContent) >= 0) {
        return; // already inserted
    }

    const insertPos = srcContent.indexOf(keyContent);
    if (insertPos < 0) {
        console.log(TAG, 'insertDestToSrcBehindKey',
            'Could not locate key content — insert skipped.', keyContent);
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
export function deleteDestToSrcBehindKey(srcPath: string, destPath: string): void {
    const srcContent = fs.readFileSync(srcPath, { encoding: 'binary' });
    const destContent = fs.readFileSync(destPath, { encoding: 'binary' });

    const pos = srcContent.indexOf(destContent);
    if (pos >= 0) {
        const result = srcContent.replace(destContent, '');
        fs.writeFileSync(srcPath, result);
    }
}
