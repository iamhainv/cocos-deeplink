# Cocos Deeplink — iOS 要求（中文）

本页介绍 iOS 平台相关的一切：扩展自动帮你做了什么，以及——大多数人最容易
出错的部分——如何正确配置 **iOS Universal Links**，使 `https://` 链接能
打开你的 App，而不是（或不仅仅是）Safari。

## 扩展自动为你做了什么

在 `enableDeeplink` 开启的情况下，每次 iOS 构建时扩展会：

1. 将 `Pre-deeplink.cmake` / `Post-deeplink.cmake` 拷贝进
   `native/engine/ios/`，并将 `deeplink/` 桥接源码（纯 Objective-C、
   ARC、无 Swift 运行时、无 `.xcframework`）拷贝进构建出的 Xcode 项目，
   成为 `proj/deeplink`。`deeplink.cmake` 将其编译为静态库，并以
   `-ObjC` 链接进 App target。
2. 向 `native/engine/ios/Info.plist` 注入一条 `CFBundleURLTypes` 条目，
   对应 `urlScheme` 选项（幂等 —— 追加前会先检查该 scheme 是否已注册）。
3. 向项目的 `.entitlements` 文件注入
   `com.apple.developer.associated-domains` 条目，对应
   `associatedDomains` 选项（同样幂等去重）。
4. `native/engine/ios/AppDelegate.mm` 中已经包含了 `DeeplinkServiceHub`
   的接线代码（`didFinishLaunchingWithOptions:` 中调用
   `initDeeplinkService` / `handleLaunchOptions:`，
   `application:openURL:options:` 中调用 `handleOpenURL:`，
   `application:continueUserActivity:restorationHandler:` 中调用
   `handleUserActivity:`），并用
   `#if __has_include("DeeplinkServiceHub.h")` 保护 —— **不需要手动修改
   AppDelegate**，只要第 1 步把库文件拷贝进去，它就会自动生效。

自定义 URL Scheme（`urlScheme`）在重新构建后即可立即生效，无需任何服务器
端配置。Universal Links（`associatedDomains`）则需要额外的服务器端步骤，
见下文。

## 权限 / 能力

- 必须在你的 Apple Developer 账号中为该 App ID 启用 **Associated
  Domains** 能力，并在 Xcode 项目的 *Signing & Capabilities* 标签页中开启
  同名能力。扩展只会把域名注入到 `.entitlements` **文件**里，但该能力也
  必须在 target/App ID 上被启用 —— 通常你第一次通过 Xcode UI 添加
  Associated Domains 条目时 Xcode 会自动完成这一步；如果你只通过
  CI/命令行构建，请到 [Apple Developer
  后台](https://developer.apple.com/account/resources/identifiers/list)
  确认该 App ID 已启用此能力。
- 自定义 URL Scheme 不需要任何其他特殊的 entitlement 或 `Info.plist`
  权限 key。

## 配置 iOS Universal Links（最容易出错的部分）

### 1. 配置构建面板

在构建面板的 **iOS** 标签页，将 `associatedDomains` 设置为逗号分隔的
列表，例如：

```
applinks:example.com
```

（可以在同一字段中用逗号追加更多域名，或使用 `webcredentials:` /
`activitycontinuation:` 前缀实现其他 Associated Domains 用途 ——
本扩展只管理 `com.apple.developer.associated-domains` 下的条目。）

### 2. 托管 Apple App Site Association（AASA）文件

请在**以下两个路径**创建并托管该文件（iOS 会优先检查 well-known 路径，
旧设备会回退到根路径 —— 托管在 well-known 路径是必须的，两处都托管最
稳妥）：

```
https://example.com/.well-known/apple-app-site-association
https://example.com/apple-app-site-association
```

内容（iOS 13+ 格式；注意文件名**没有 `.json` 扩展名**）：

```json
{
  "applinks": {
    "details": [
      {
        "appIDs": ["TEAMID1234.com.yourcompany.yourapp"],
        "components": [
          { "/": "/product/*", "comment": "匹配任意 /product/* URL" },
          { "/": "/share/*", "comment": "匹配任意 /share/* URL" }
        ]
      }
    ]
  }
}
```

- `TEAMID1234` 是你的 **Apple Developer Team ID**（10 位字符，可在 Apple
  Developer 后台 → *Membership* 中查看），`com.yourcompany.yourapp` 是你
  App 的 Bundle Identifier —— 二者组合成 Apple 所需的 `appID`。
- `components` 用于限定哪些路径打开 App、哪些走 Safari；省略它（或使用
  `{ "/": "*" }`）表示匹配该域名下的所有路径。
- 较早/较简单的 App 可能使用扁平的 `"paths": ["/product/*",
  "/share/*"]` 格式，两种格式都被接受，新项目建议优先使用
  `components`（它还支持按 query/fragment 匹配）。

托管要求（iOS 会在**安装时**逐项检查，并缓存结果 —— 见下方故障排查中的
说明）：

- 必须通过 **HTTPS** 提供，且证书有效（不能是自签名 / 过期证书）。
- **完全不能有重定向** —— 不能是 HTTP→HTTPS，不能是 `www.` 重定向，
  什么重定向都不行。请直接把文件托管在最终的 HTTPS 地址上。
- **文件名不带扩展名**（是 `apple-app-site-association`，不是 `.json`）。
- `Content-Type` 应为 `application/json`（部分 CDN 由于文件没有扩展名
  无法自动推断 MIME 类型，需要显式配置）。
- 文件大小限制：**128 KB**。
- 必须公开可访问，无需身份验证。

依赖它之前先快速检查一下：

```bash
curl -sI https://example.com/.well-known/apple-app-site-association
curl -s  https://example.com/.well-known/apple-app-site-association | python3 -m json.tool
```

Apple 也在 Xcode 中提供了校验工具：*Signing & Capabilities* → 域名那一
行旁边的小型 AASA 状态指示器；也可以使用第三方校验工具，例如
https://branch.io/resources/aasa-validator/。

### 3. 在 Xcode 中启用 Associated Domains 能力

如果你直接通过 Xcode 构建（而不仅仅通过 Cocos 构建流程）：

1. 选择 App target → **Signing & Capabilities**。
2. 点击 **+ Capability** → **Associated Domains**（如果已存在则跳过 ——
   扩展的 entitlements 注入只修改文件内容，这一步是向你的 App ID 注册
   该能力）。
3. 添加条目 `applinks:example.com`（扩展注入完成后通常已自动存在 ——
   请核对内容是否一致）。

### 4. 重新构建、重装并测试

iOS 会在**安装时**拉取并缓存 AASA 文件（之后会周期性重新拉取）——
它**不会**在每次启动时重新拉取。如果你修改了服务器上的 AASA 文件，
必须**卸载并重新安装** App（或等待 iOS 的周期性重新拉取），测试时才能
看到更新生效。

测试方法：

```bash
xcrun simctl openurl booted "https://example.com/product/42"
```

或在真机上，通过（例如）信息/备忘录把链接发给自己并点击 —— 长按链接选择
"用〈你的 App〉打开" 也可以确认关联关系是否生效，即使直接点按打开的是
Safari（这可能是因为用户针对该 App 设置了"始终在 Safari 中打开"，路径为
设置 → 〈你的 App〉→ *关联的域名* / *打开链接*，需要确认用户没有将其设为
"在 Safari 中"）。

处理完成后，自定义 Scheme 和 Universal Links 可以用同一套方式读取解析后
的 URL：

```ts
import { deeplink } from 'db://deeplink/index';

deeplink.onDeeplinkReceived((url) => {
    console.log('scheme:', url.scheme, 'path:', url.path);
});
await deeplink.initialize();
```

### 常见校验失败原因

| 现象 | 可能原因 |
| --- | --- |
| 链接总是打开 Safari | AASA 不可访问、content-type 错误、存在重定向，或自上次修改后尚未被重新拉取（需要重装 App） |
| 模拟器上正常，真机上不正常 | 模拟器对 AASA 缓存的处理方式不完全一致；上线前请务必在真机上测试 |
| 长按 "用 App 打开" 有效，直接点按无效 | 用户设置了针对该 App 的"始终在 Safari 打开"偏好 —— 检查 设置 → 〈你的 App〉 |
| Xcode 中 `appIDs` 显示有效但链接仍失败 | AASA 中 `appIDs` 字符串里 Team ID 或 Bundle ID 拼写错误 —— 必须完全一致，区分大小写 |

## 构建配置

- 最低 iOS 部署目标：**iOS 13.0**（与 Cocos 项目的最低要求一致，配置于
  `deeplink.cmake`）。
- 无第三方依赖，无 Swift 运行时，无 `.xcframework` —— 桥接层是纯
  Objective-C，通过 CMake 编译为静态库。
- 链接的系统框架：`Foundation`、`UIKit`（均已由 Cocos 引擎 target 链接，
  此处显式声明是一种防御性写法）。

## 已知限制

- `isDomainAssociated()` **在 iOS 上不可用** —— 始终以 `E_NOT_SUPPORTED`
  拒绝。iOS 没有公开的 API 可以在运行时查询 Universal Links 的校验状态，
  开发阶段请改用上文提到的 AASA 校验工具。
- `navigateToOpenByDefaultSettings()` 仅限 Android，在 iOS 上以
  `E_NOT_SUPPORTED` 拒绝 —— 如果用户关闭了该 App 的 Universal Links，
  需要手动引导他们前往 **设置 → 〈你的 App〉**。
- 关闭 `enableDeeplink` 不会追溯性地移除此前已构建项目中注入的
  `CFBundleURLTypes` / Associated Domains 条目 —— 如需完全干净的状态，
  请对原生项目执行 clean build。
