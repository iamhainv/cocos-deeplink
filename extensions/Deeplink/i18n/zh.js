module.exports = {
    title: 'Deeplink — Universal Links（Android App Links + iOS Universal Links / 自定义 URL Scheme）',
    description: 'Deeplink — 向构建的原生项目注入 intent-filter（Android App Links）和 CFBundleURLTypes / Associated Domains（iOS Universal Links）。',

    // ---- 共用 ----
    enableDeeplink: {
        title: '启用 Deeplink',
        tip: '整体启用或禁用 Deeplink 扩展。设为 false 时，跳过库拷贝以及所有 manifest/plist/entitlements 注入。',
    },
    overwriteLibrary: {
        title: '强制覆盖 Deeplink 库文件',
        tip: '每次构建时强制用扩展模板中的文件覆盖构建目录中的原生库文件。如需保留手动修改请关闭此选项。',
    },

    // ---- Android ----
    scheme: {
        title: 'URI Scheme（Android）',
        tip: 'Android intent-filter 的 URI scheme（如 "https"、"http" 或自定义 scheme）。留空则跳过 intent-filter 注入。',
    },
    host: {
        title: '域名（Android）',
        tip: 'Android intent-filter 的 host（如 "example.com"）。使用 "http" 或 "https" scheme 时，App Links 必须填写 host。',
    },
    pathPrefix: {
        title: '路径前缀（Android）',
        tip: 'Android intent-filter 的可选路径前缀（如 "/app"）。留空则省略 android:pathPrefix 属性。',
    },
    autoVerify: {
        title: '自动验证（Android App Links）',
        tip: '启用后，在 intent-filter 元素上设置 android:autoVerify="true"，开启 Android App Links 域名验证。',
    },
    label: {
        title: 'Intent Filter 标签（Android）',
        tip: 'intent-filter 元素的可选 android:label 属性。留空则省略。',
    },

    // ---- iOS ----
    urlScheme: {
        title: 'URL Scheme（iOS）',
        tip: '在 Info.plist 的 CFBundleURLTypes 中注册的自定义 URL scheme（如 "myapp"）。留空则跳过 URL scheme 注入。',
    },
    associatedDomains: {
        title: 'Associated Domains（iOS Universal Links）',
        tip: '以逗号分隔的 Associated Domains，将写入 .entitlements 文件的 com.apple.developer.associated-domains 键（如 "applinks:example.com"）。留空则跳过。',
    },
};
