# Third-Party Notices

Cocos Deeplink may bundle or depend on third-party software. Their licenses are
reproduced below (or referenced) as required by their respective terms.

This extension does not vendor or commit any third-party binaries. It links
one Gradle-resolved Android library (fetched from Google's Maven repository
at build time, not committed to this repository) and two stock Apple system
frameworks on iOS (no third-party code at all).

| Component | Version | License | Notes |
| --- | --- | --- | --- |
| AndroidX Core (`androidx.core:core`) | 1.13.1 | Apache License 2.0 | Declared as a Gradle dependency in `extensions/Deeplink/template/android/libdeeplink/build.gradle`; resolved from Google's Maven repository at build time. Verified against the published POM (`https://maven.google.com/androidx/core/core/1.13.1/core-1.13.1.pom`), which declares `The Apache Software License, Version 2.0`. Not vendored in this repository. License: https://www.apache.org/licenses/LICENSE-2.0 |
| Apple `Foundation.framework` | iOS SDK (system) | Apple SDK license (part of Xcode/iOS SDK) | Linked in `extensions/Deeplink/template/ios/deeplink/deeplink.cmake`. Ships with Xcode; not distributed by this repository. |
| Apple `UIKit.framework` | iOS SDK (system) | Apple SDK license (part of Xcode/iOS SDK) | Linked alongside `Foundation.framework` for URL/scene-activation handling. Ships with Xcode; not distributed by this repository. |

The Android and iOS native bridges under `extensions/Deeplink/template/` are
this project's own source code (`DeeplinkServiceHub.h`/`.mm` on iOS, the
`libdeeplink` sources on Android); no third-party native code is bundled.
