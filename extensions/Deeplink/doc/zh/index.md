# Cocos Deeplink（中文）

一个 Cocos Creator 3.8.x 构建插件扩展：向构建出的原生项目注入 Android App
Links（带 `autoVerify` 的 `intent-filter`）和 iOS Universal Links / 自定义
URL Scheme（`CFBundleURLTypes`、Associated Domains），并提供一套精简的异步
TypeScript 运行时 API，用于接收深链接 URL —— 既包括启动 App 的链接（冷启
动），也包括 App 运行期间收到的链接（热启动）。

## 兼容性

| Cocos Creator | Android | iOS | Web / 编辑器预览 |
| --- | --- | --- | --- |
| >= 3.8.0 | Android 5.0+（API 21+）；`autoVerify` 域名校验需要 API 31+ | iOS 13.0+ | 不支持 —— 所有 API 调用都会以 `E_NOT_SUPPORTED` 拒绝 |

## 安装

1. 将 `extensions/Deeplink` 复制到项目的 `extensions/` 目录下。
2. 在终端中构建一次扩展（本仓库已提交编译好的 `dist/`，只有你修改了
   `source/` 之后才需要这一步）：
   ```bash
   cd extensions/Deeplink
   npm install
   npm run build
   ```
3. 重启 Cocos Creator，或通过 **扩展 → 扩展管理器** 启用该扩展（名称为
   **Deeplink**）。
4. 打开 **项目 → 构建发布**，选择 **Android** 或 **iOS** 平台标签页，
   按下文说明配置 Deeplink 选项（或直接使用默认值快速搭建一个 "https"
   App Link）。
5. 从扩展的 asset-db 挂载路径导入运行时 API：
   ```ts
   import { deeplink } from 'db://deeplink/index';
   ```

## 构建面板选项

Android 和 iOS 标签页各自拥有独立的选项集，二者共用
`enableDeeplink` / `overwriteLibrary`。

### 共用选项

| 选项 | 默认值 | 说明 |
| --- | --- | --- |
| **启用 Deeplink**（`enableDeeplink`） | `true` | 总开关。关闭后，该平台构建会跳过原生库拷贝以及所有 manifest/plist/entitlements 注入。 |
| **强制覆盖 Deeplink 库文件**（`overwriteLibrary`） | `true` | 每次构建都用扩展模板中的文件覆盖构建目录中的原生库文件。关闭可保留你直接对构建产物做的手动修改（不建议用于 CI）。 |

### Android 标签页

| 选项 | 默认值 | 说明 |
| --- | --- | --- |
| **URI Scheme**（`scheme`） | `https` | 生成的 `intent-filter` 的 `android:scheme`。真正的 App Links 请使用 `https`；仅需要自定义 scheme 深链接可填 `myapp` 等自定义值。留空则完全跳过 `intent-filter` 注入。 |
| **域名**（`host`） | 空 | `android:host`（如 `example.com`）。当 scheme 为 `http`/`https` 时**必填**——没有 host，App Links 无法工作，若留空构建日志会给出警告。 |
| **路径前缀**（`pathPrefix`） | 空 | 可选的 `android:pathPrefix`（如 `/app`）。留空时不写入 manifest。 |
| **自动验证**（`autoVerify`） | `true` | 在 `intent-filter` 上设置 `android:autoVerify="true"`，使 Android 对你域名下的 `assetlinks.json` 执行 Digital Asset Links 校验（详见 [Android 要求](./android/index.md)）。 |
| **Intent Filter 标签**（`label`） | 空 | `intent-filter` 元素上可选的 `android:label`。留空则省略。 |

### iOS 标签页

| 选项 | 默认值 | 说明 |
| --- | --- | --- |
| **URL Scheme**（`urlScheme`） | 空 | 注册为 `Info.plist` 中 `CFBundleURLTypes` 条目的自定义 URL scheme（如 `myapp`）。留空则跳过。幂等——重复构建不会产生重复条目。 |
| **Associated Domains**（`associatedDomains`） | 空 | 以逗号分隔的列表，写入项目 `.entitlements` 文件的 `com.apple.developer.associated-domains`（如 `applinks:example.com`）。留空则跳过。这是 Universal Links 在 iOS 端的一半配置——完整流程（包括 `apple-app-site-association` 文件）见 [iOS 要求](./ios/index.md)。 |

## API 参考

从扩展的 asset-db barrel 统一导入：

```ts
import { deeplink, DeeplinkClient } from 'db://deeplink/index';
import type { DeeplinkUrl, DeeplinkError } from 'db://deeplink/index';
```

`deeplink` 是一个开箱即用的 `DeeplinkClient` 单例。所有方法均为异步，失败
时以 `DeeplinkError`（`{ code, message }`）拒绝。

### `deeplink.initialize(): Promise<void>`

初始化深链接系统，需要在 App 启动时调用一次。**必须在调用本方法之前先注册
`onDeeplinkReceived` 处理函数**——原生端会缓存冷启动 URL（启动 App 的那个
链接，如果存在的话），并在本方法调用期间同步地以 `deeplinkReceived` 事件
派发出去。在 `initialize()` resolve 之后才注册的处理函数会错过冷启动事件。

### `deeplink.getLink(): Promise<DeeplinkUrl>`

返回当前（最近一次收到的）深链接 URL。尚未收到任何链接时，`DeeplinkUrl`
的所有字符串字段均为 `""`。可通过 `url.url !== ''` 判断是否存在链接。

### `deeplink.clearData(): Promise<void>`

清除两个平台上存储的深链接数据，之后 `getLink()` 会返回空的
`DeeplinkUrl`，直到收到新链接为止。建议在处理完当前链接后调用，以避免下次
冷启动时重复处理。

### `deeplink.isDomainAssociated(domain: string): Promise<boolean>`

**仅限 Android 12+（API 31+）。** 检查 `domain` 是否已被系统验证为该 App 的
Android App Link（系统会根据你域名下的 `assetlinks.json` 进行校验）。在
iOS 以及 API 31 以下的 Android 上会以 `E_NOT_SUPPORTED` 拒绝。

### `deeplink.navigateToOpenByDefaultSettings(): Promise<void>`

**仅限 Android。** 打开系统的“默认打开方式”设置页面，用户可在此更改哪些
链接域名会打开本 App。Promise 会在用户返回 App 后 resolve（内部不设超时，
因为用户在设置页停留的时间不确定）。在 iOS 上以 `E_NOT_SUPPORTED` 拒绝。

### `deeplink.onDeeplinkReceived(handler: (url: DeeplinkUrl) => void): void`

订阅每一次深链接投递——包括冷启动链接（在 `initialize()` 期间触发一次）
和任意后续的热启动链接（只要系统向正在运行的 App 投递新 URL 就会触发）。

### `deeplink.offDeeplinkReceived(handler): void`

取消订阅先前传给 `onDeeplinkReceived` 的处理函数。

### `DeeplinkUrl`

```ts
interface DeeplinkUrl {
    url: string;              // 完整 URL，不存在时为 ""
    scheme: string;            // 如 "myapp"、"https"
    host: string;               // 如 "example.com"
    port?: number;
    path: string;                // 如 "/items/42"
    pathExtension?: string;
    pathComponents?: string[];
    query?: string;               // 不含开头的 "?"
    fragment?: string;             // 不含开头的 "#"
    user?: string;
    password?: string;
}
```

### `DeeplinkError`

```ts
interface DeeplinkError {
    code: string;     // 如 "E_NOT_SUPPORTED"、"E_TIMEOUT"
    message: string;
}
```

内置错误码：`E_NOT_SUPPORTED`（在 web/编辑器上调用，或在错误的平台上调用了
某平台专属方法）、`E_TIMEOUT`（在调用超时窗口内未收到原生响应）。其他错误
码为平台特定错误。

## 示例

最简启动接线代码，例如放在启动场景的 `onLoad` 中：

```ts
import { deeplink } from 'db://deeplink/index';

deeplink.onDeeplinkReceived((url) => {
    console.log('收到深链接:', url.url);
    if (url.path === '/product') {
        openProductScreen(url.query);
    }
});

await deeplink.initialize();
```

仓库根目录内置了一个可直接运行的演示，展示冷启动链接、"复制到剪贴板"
按钮，以及实时记录收到的每一条链接：

- 场景：[`assets/scene/main.scene`](../../../assets/scene/main.scene)
- 脚本：[`assets/script/test/DeeplinkTest.ts`](../../../assets/script/test/DeeplinkTest.ts)

## 故障排查

- **构建面板显示原始的 `i18n:deeplink.xxx` 字符串而不是标签** —— 说明
  `i18n/en.js` / `i18n/zh.js` 缺少 `source/builder.ts` 用到的某个 key。
  `i18n/*.js` 未经编译，修改后无需 `npm run build`，但 Creator 可能有缓存，
  需要 **开发者 → 重新加载扩展**。
- **Gradle 同步失败，提示 "project ':libdeeplink' not found"** ——
  `settings.gradle` 片段没有被注入。确认 `enableDeeplink` 已开启并重新构建；
  检查 `native/engine/android/app/build.gradle` 与构建产物中的
  `settings.gradle` 是否都包含自动生成的 `libdeeplink` 相关行（搜索
  `Generated by Deeplink Extension`）。
- **Android 构建出现 "Duplicate class"** —— 通常是与另一个同样声明了相同包
  名的扩展原生库混用导致的。`libdeeplink` 使用独立包名
  `com.cocos.deeplink`，正常情况下不会发生，除非你手动把它的 Java 源码复制
  到了别处。
- **CMake 报错：找不到 target `deeplink` / target 重复** —— 确认
  `native/engine/ios/` 下只存在一份 `Pre-deeplink.cmake` /
  `Post-deeplink.cmake`（此前若曾以 `enableDeeplink=false` 构建过应已自动
  删除；若未删除，手动删除后重新构建）。
- **链接能打开 App，但 `getLink()` / 事件收不到数据** —— 请仔细核对
  Android 的 `intent-filter` 或 iOS 的 `CFBundleURLTypes` /
  Associated Domains 是否与你测试的链接真正匹配，以及是否在调用
  `initialize()` 之前注册了 `onDeeplinkReceived`。
- **Android App Links 打开的是浏览器而不是 App** —— 几乎总是校验失败导致。
  请查看 [Android 要求](./android/index.md)：`assetlinks.json` 必须可通过
  HTTPS 访问、`Content-Type` 为 `application/json`、列出构建所用的确切
  SHA-256 签名指纹，并且 `autoVerify` 必须为 `true`。
- **iOS Universal Links 打开的是 Safari 而不是 App** —— 请查看 [iOS
  要求](./ios/index.md)：`apple-app-site-association` 文件必须通过 HTTPS
  提供、不能有任何重定向、文件名不带扩展名，且必须在 Xcode 中启用
  Associated Domains 能力并添加匹配的 `applinks:` 条目。

## 已知限制

- `isDomainAssociated()` 和 `navigateToOpenByDefaultSettings()` 仅限
  Android，在 iOS 上都会以 `E_NOT_SUPPORTED` 拒绝。
- `isDomainAssociated()` 还要求 Android 12+（API 31+）；更低版本同样会以
  `E_NOT_SUPPORTED` 拒绝（API 31 以下系统没有公开的校验状态查询接口）。
- 关闭 `enableDeeplink` **不会**追溯性地移除此前已注入到 iOS 项目中的
  `CFBundleURLTypes` / Associated Domains 条目（只会清理 CMake 集成文件）。
  如需完全干净的状态，请对原生项目执行 clean build。
- 扩展本身不解析自定义查询参数结构，也不做 App 内路由——`DeeplinkUrl`
  只提供解析后的 URL 各组成部分，基于 `path`/`query` 的路由逻辑由你的游戏
  代码自行实现。
