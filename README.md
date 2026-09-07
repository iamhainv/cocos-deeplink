# Cocos Deeplink

[![CI](https://github.com/iamhainv/cocos-deeplink/actions/workflows/ci.yml/badge.svg)](https://github.com/iamhainv/cocos-deeplink/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[English](#english) | [中文](#中文)

---

<a id="english"></a>
## English

A Cocos Creator 3.8.x extension that injects Android App Links
(`intent-filter` + `autoVerify`) and iOS Universal Links / custom URL
schemes (`CFBundleURLTypes`, Associated Domains) into the built native
project, plus a small async TypeScript API for receiving deep-link URLs —
both the link that launched the app (cold start) and any link delivered
while the app is already running.

### Features

- `deeplink.initialize()` / `deeplink.onDeeplinkReceived(handler)` — cold-start
  and live deep-link delivery via a single event, with correct buffering so
  the launch link is never missed.
- `deeplink.getLink()` / `deeplink.clearData()` — query or reset the stored link.
- Android App Links: build-panel-driven `intent-filter` generation
  (`scheme`/`host`/`pathPrefix`/`autoVerify`/`label`) plus
  `deeplink.isDomainAssociated(domain)` and
  `deeplink.navigateToOpenByDefaultSettings()` (Android 12+).
- iOS: idempotent injection of `CFBundleURLTypes` (custom scheme) and
  Associated Domains (Universal Links) into the built Xcode project;
  `AppDelegate.mm` wiring is already in place, no manual native edits needed.
- Promise-based API; rejects with `{ code: 'E_NOT_SUPPORTED' }` on web/editor
  preview instead of throwing or crashing.
- Pure native code — no third-party SDK, no `.xcframework`, no Maven dependency.

### Demo

A runnable demo lives at the project root:

- Scene: [`assets/scene/main.scene`](./assets/scene/main.scene)
- Script: [`assets/script/test/DeeplinkTest.ts`](./assets/script/test/DeeplinkTest.ts)

Open this repo as a Cocos Creator 3.8.x project, open `main.scene`, and run
it on an Android or iOS device/simulator build. It builds its whole UI in
code and shows: the cold-start launch link (if the app was opened via a
link), a **Copy Link** button, and a live log of every link received while
the app keeps running. On web preview it shows a status message instead of
attempting native calls, since deep-link delivery isn't available there.

> **Known first-open caveat**: `main.scene` was hand-authored (not saved by
> the Creator GUI), and the `DeeplinkTest` component is referenced by the
> script asset's full UUID rather than Creator's internal compressed script
> id. If Creator shows a "script asset lost" / missing-script warning on the
> `Content` node the first time you open the project, just re-drag
> `assets/script/test/DeeplinkTest.ts` onto that node in the Inspector and
> re-save the scene — a one-time fix; only the `Content` node is affected,
> nothing else is at risk.

### Compatibility

| Cocos Creator | Android | iOS | Web |
| --- | --- | --- | --- |
| >= 3.8.0 | Yes (API 21+; App Links verification needs API 31+) | Yes (13.0+) | Preview only (native features degrade gracefully) |

### Installation

1. Copy `extensions/Deeplink` into your project's `extensions/` folder.
2. Restart Cocos Creator, or use **Extension → Extension Manager** to enable it.
3. Configure the Android/iOS options on the build panel — see
   [doc/en](./extensions/Deeplink/doc/en/index.md) for every option explained.
4. Import from the extension's asset-db mount:
   ```ts
   import { deeplink } from 'db://deeplink/index';

   deeplink.onDeeplinkReceived((url) => console.log('deep link:', url.url));
   await deeplink.initialize();
   ```
5. See the full documentation: [doc/en](./extensions/Deeplink/doc/en/index.md)
   — **it is worth reading fully**, since correctly hosting
   `apple-app-site-association` (iOS) and `assetlinks.json` (Android) is the
   part almost everyone gets wrong on the first try.

### Documentation

- English: [extensions/Deeplink/doc/en/index.md](./extensions/Deeplink/doc/en/index.md)
  ([Android](./extensions/Deeplink/doc/en/android/index.md) ·
  [iOS](./extensions/Deeplink/doc/en/ios/index.md))
- 中文: [extensions/Deeplink/doc/zh/index.md](./extensions/Deeplink/doc/zh/index.md)
  ([Android](./extensions/Deeplink/doc/zh/android/index.md) ·
  [iOS](./extensions/Deeplink/doc/zh/ios/index.md))

### License

MIT — see [LICENSE](./LICENSE).

### Trademarks

This project is an independent, community-maintained wrapper and is **not
affiliated with, endorsed by, or sponsored by** Cocos, Google, or Apple.
"Cocos Creator", "AdMob", "Firebase", "Google Play" and "App Store" are
trademarks of their respective owners.

---

<a id="中文"></a>
## 中文

一个 Cocos Creator 3.8.x 扩展，用于向构建出的原生项目注入 Android App
Links（`intent-filter` + `autoVerify`）和 iOS Universal Links / 自定义 URL
Scheme（`CFBundleURLTypes`、Associated Domains），并提供一套精简的异步
TypeScript API 用于接收深链接 URL —— 既包括启动 App 的链接（冷启动），
也包括 App 运行期间收到的链接。

### 功能特性

- `deeplink.initialize()` / `deeplink.onDeeplinkReceived(handler)` ——
  通过同一个事件同时处理冷启动与实时深链接投递，并有正确的缓冲机制，
  保证启动链接不会被漏掉。
- `deeplink.getLink()` / `deeplink.clearData()` —— 查询或重置当前存储的
  链接。
- Android App Links：由构建面板驱动的 `intent-filter` 生成
  （`scheme`/`host`/`pathPrefix`/`autoVerify`/`label`），以及
  `deeplink.isDomainAssociated(domain)` 与
  `deeplink.navigateToOpenByDefaultSettings()`（Android 12+）。
- iOS：向构建出的 Xcode 项目幂等注入 `CFBundleURLTypes`（自定义 scheme）
  和 Associated Domains（Universal Links）；`AppDelegate.mm` 接线代码已
  就绪，无需手动修改原生代码。
- 基于 Promise 的 API；在 Web/编辑器预览下以 `{ code: 'E_NOT_SUPPORTED' }`
  拒绝，而不是抛出异常或崩溃。
- 纯原生代码 —— 无第三方 SDK、无 `.xcframework`、无 Maven 依赖。

### 演示

项目根目录内置了一个可直接运行的演示：

- 场景：[`assets/scene/main.scene`](./assets/scene/main.scene)
- 脚本：[`assets/script/test/DeeplinkTest.ts`](./assets/script/test/DeeplinkTest.ts)

用 Cocos Creator 3.8.x 打开本仓库作为项目，打开 `main.scene`，然后构建到
Android 或 iOS 设备/模拟器运行。界面完全由代码构建，展示内容包括：冷启动
链接（若 App 是通过链接打开的）、一个 **复制链接** 按钮，以及 App 运行期间
收到的每条链接的实时日志。Web 预览下会显示状态提示而不会尝试调用原生
接口，因为深链接投递在 Web 上不可用。

> **首次打开的已知注意事项**：`main.scene` 是手工编写的（并非通过 Creator
> 编辑器保存），其中 `DeeplinkTest` 组件是通过脚本资源的完整 UUID 引用的，
> 而不是 Creator 内部的压缩脚本 ID。如果首次打开项目时 Creator 在
> `Content` 节点上提示"脚本丢失"之类的警告，只需将
> `assets/script/test/DeeplinkTest.ts` 重新拖拽到该节点的 Inspector 面板
> 上并重新保存场景即可 —— 这是一次性修复，只影响 `Content` 节点，不会
> 影响项目其他部分。

### 兼容性

| Cocos Creator | Android | iOS | Web |
| --- | --- | --- | --- |
| >= 3.8.0 | 支持（API 21+；App Links 校验需要 API 31+） | 支持（13.0+） | 仅预览（原生功能会优雅降级） |

### 安装

1. 将 `extensions/Deeplink` 复制到项目的 `extensions/` 目录下。
2. 重启 Cocos Creator，或通过 **扩展 → 扩展管理器** 启用该扩展。
3. 在构建面板中配置 Android/iOS 选项 —— 每个选项的详细说明见
   [doc/zh](./extensions/Deeplink/doc/zh/index.md)。
4. 从扩展的 asset-db 挂载路径导入：
   ```ts
   import { deeplink } from 'db://deeplink/index';

   deeplink.onDeeplinkReceived((url) => console.log('深链接:', url.url));
   await deeplink.initialize();
   ```
5. 查看完整文档：[doc/zh](./extensions/Deeplink/doc/zh/index.md) ——
   **强烈建议完整阅读**，因为正确托管 `apple-app-site-association`
   （iOS）和 `assetlinks.json`（Android）是几乎所有人第一次尝试时都会
   出错的部分。

### 文档

- English: [extensions/Deeplink/doc/en/index.md](./extensions/Deeplink/doc/en/index.md)
  （[Android](./extensions/Deeplink/doc/en/android/index.md) ·
  [iOS](./extensions/Deeplink/doc/en/ios/index.md)）
- 中文: [extensions/Deeplink/doc/zh/index.md](./extensions/Deeplink/doc/zh/index.md)
  （[Android](./extensions/Deeplink/doc/zh/android/index.md) ·
  [iOS](./extensions/Deeplink/doc/zh/ios/index.md)）

### 许可证

MIT — 详见 [LICENSE](./LICENSE)。

### 商标声明

本项目为独立的社区维护封装库，**与 Cocos、Google、Apple 均无关联，未获得其
认可或赞助**。"Cocos Creator"、"AdMob"、"Firebase"、"Google Play" 与
"App Store" 均为其各自所有者的商标。
