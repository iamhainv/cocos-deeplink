# Cocos Deeplink — Android 要求（中文）

本页介绍 Android 平台相关的一切：扩展自动帮你做了什么，以及——大多数人最
容易出错的部分——如何正确配置 **Android App Links**，使 `https://` 链接
能打开你的 App，而不是（或不仅仅是）浏览器。

## 扩展自动为你做了什么

在 `enableDeeplink` 开启的情况下，每次 Android 构建时扩展会：

1. 将 `template/android/libdeeplink/` 拷贝进构建产物，成为
   `proj/libdeeplink` —— 一个小型 Android library module（包名
   `com.cocos.deeplink`），其中包含 `DeeplinkActivity`（一个透明的中转
   Activity，用于接收 `ACTION_VIEW` intent）和 `DeeplinkInitProvider`
   （一个 `ContentProvider`，会在 `Application.onCreate()` 执行之前就注册
   JS 桥监听器，因此即使 App 是被链接本身冷启动的，也不会漏掉该链接）。
2. 向 `settings.gradle` 追加 `include ':libdeeplink'`，向
   `native/engine/android/app/build.gradle` 追加
   `implementation project(':libdeeplink')` 依赖 —— 两处插入都是幂等的
   （插入前会检查标记内容），重复构建不会产生重复内容。
3. 根据构建面板选项（`scheme`、`host`、`pathPrefix`、`autoVerify`、
   `label`）生成 `<intent-filter>` 代码块，并替换掉 `libdeeplink`
   的 `AndroidManifest.xml` 中的 `<!-- DEEPLINK_INTENT_FILTER -->`
   占位符。

仅凭以上步骤并不能让 `https://` 链接自动打开你的 App —— Android 还要求你
**证明域名所有权**，也就是下面的 App Links 校验步骤。

## 权限 / 能力

不需要任何危险权限。`DeeplinkActivity` 声明了
`android:exported="true"`（这是让系统/其他 App 能够向它投递
`ACTION_VIEW` intent 所必需的），但除了把 URI 转发给 JS 桥并自我
finish 之外不做任何事，也不声明其他能力。

## 配置 Android App Links（最容易出错的部分）

请严格按以下步骤操作 —— 指纹错误、content-type 错误、存在重定向，
任何一处都会悄无声息地导致校验失败，Android 会退回到用浏览器打开链接。

### 1. 配置构建面板

在构建面板的 **Android** 标签页：

- `scheme` = `https`
- `host` = 你的真实域名，例如 `example.com`
- `autoVerify` = `true`（默认值）

这会生成等价于下面内容的 intent-filter：

```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW"/>
    <category android:name="android.intent.category.DEFAULT"/>
    <category android:name="android.intent.category.BROWSABLE"/>
    <data android:scheme="https" android:host="example.com"/>
</intent-filter>
```

### 2. 获取签名证书的 SHA-256 指纹

App Links 校验与 APK/AAB 实际使用的签名证书严格绑定。获取你用于构建的
keystore 的指纹：

```bash
keytool -list -v -keystore /path/to/your.keystore -alias your-key-alias
```

找到 `SHA256:` 那一行，形如：

```
SHA256: 14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A3:79:80:D9:6C:BD:56:C7:A9:83:0F:DC:8C:B4:37
```

- **若通过 Google Play App Signing 发布**（新 App 的默认方式），你需要的
  指纹是 Play 的 **App 签名密钥证书**，可在 Play Console → *设置* →
  *应用完整性* → *App 签名密钥证书* 中查看 —— 而不是本地上传密钥库的
  指纹。
- 内部/侧载构建，使用你实际签名所用 keystore 的指纹即可。
- `assetlinks.json` 中可以同时列出多个指纹（例如 debug + release），
  见下文。

### 3. 托管 `assetlinks.json`

在**恰好**如下路径创建并托管该文件：

```
https://example.com/.well-known/assetlinks.json
```

内容：

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.yourcompany.yourapp",
      "sha256_cert_fingerprints": [
        "14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A3:79:80:D9:6C:BD:56:C7:A9:83:0F:DC:8C:B4:37"
      ]
    }
  }
]
```

托管要求（Android 会逐项检查）：

- 必须通过 **HTTPS** 提供（纯 HTTP 会被拒绝）。
- 访问过程中**不能有任何重定向**（哪怕是 HTTP→HTTPS 也不行 —— 直接把文件
  托管在最终的 HTTPS 地址上）。
- `Content-Type: application/json`（部分静态托管服务对 `.json` 文件默认
  返回 `text/plain` 或 `application/octet-stream`，请用 `curl -I` 检查）。
- 无需身份验证、无地域屏蔽、也没有被 CDN 的 robots 规则挡掉，必须公开可
  访问。
- `package_name` 必须与 App 的 `applicationId` 完全一致。
- `sha256_cert_fingerprints` 必须与用于测试的构建所使用的签名证书完全
  一致（冒号分隔、大写十六进制，与 `keytool` 输出格式相同）。

依赖它之前先快速检查一下：

```bash
curl -sI https://example.com/.well-known/assetlinks.json | grep -i content-type
curl -s  https://example.com/.well-known/assetlinks.json | python3 -m json.tool
```

Google 也提供了一个校验工具：
https://developers.google.com/digital-asset-links/tools/generator

### 4. 重新构建并验证

Android 会在安装时（API 31+）或首次跳转链接时（API 23–30）自动执行校验
—— 不需要调用扩展的任何 API 来"触发"它。若要在运行时查询*校验结果*
（仅限 API 31+）：

```ts
import { deeplink } from 'db://deeplink/index';

const associated = await deeplink.isDomainAssociated('example.com');
console.log('example.com 的 App Links 校验状态:', associated);
```

也可以用 ADB 查看校验状态：

```bash
adb shell pm get-app-links com.yourcompany.yourapp
```

或者引导用户前往系统设置页手动修正：

```ts
await deeplink.navigateToOpenByDefaultSettings();
```

### 常见校验失败原因

| 现象 | 可能原因 |
| --- | --- |
| 链接打开的是浏览器而不是 App | `assetlinks.json` 不可访问、content-type 错误，或链路中存在重定向 |
| `pm get-app-links` 显示 `verify failed` | 指纹不匹配 —— 很可能托管的是*上传密钥*指纹，但 Play 用 *App 签名密钥* 重新签了名 |
| 部分设备正常、部分设备不正常 | API 31+ 上，Google Play 服务需要联网才能在安装时拉取
`assetlinks.json`；离线侧载安装的设备可能需要手动重新校验（`adb shell pm verify-app-links --re-verify <package>`，需在已启用调试的设备上通过 `adb shell` 执行） |
| `adb install` 后立即可用，从 Play 商店安装却失败 | Play 商店安装路径会独立执行校验 —— 请重新确认托管的是 **Play App Signing** 指纹，而不是本地密钥指纹 |

## 构建配置

- `minSdkVersion` / `compileSdkVersion` / `targetSdkVersion`
  均读取自项目的全局 Android 构建设置（`PROP_MIN_SDK_VERSION` 等）——
  扩展不会硬编码或覆盖它们。
- 该库自身的 `build.gradle` 依赖 `androidx.core:core:1.13.1`，以及对
  `:libcocos` 的项目依赖（由 Cocos 原生模板提供）。

## 已知限制

- `autoVerify` 的校验过程完全由系统驱动，扩展只负责设置 manifest 标志位，
  无法强制触发重新校验（测试时可使用 `adb shell pm verify-app-links
  --re-verify`）。
- `isDomainAssociated()` 要求 API 31+；旧版本设备没有等效的编程接口 ——
  请改用 `pm get-app-links`（ADB）或手动测试。
