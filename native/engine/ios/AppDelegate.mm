/****************************************************************************
 Copyright (c) 2010-2013 cocos2d-x.org
 Copyright (c) 2013-2016 Chukong Technologies Inc.
 Copyright (c) 2017-2022 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated engine source code (the "Software"), a limited,
 worldwide, royalty-free, non-assignable, revocable and non-exclusive license
 to use Cocos Creator solely to develop games on your target platforms. You shall
 not use Cocos Creator software for developing other software or tools that's
 used for developing games. You are not granted to publish, distribute,
 sublicense, and/or sell copies of Cocos Creator.

 The software or tools in this License Agreement are licensed, not sold.
 Xiamen Yaji Software Co., Ltd. reserves all rights not expressly granted to you.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
****************************************************************************/

#import "AppDelegate.h"
#import "ViewController.h"
#import "View.h"

#include "platform/ios/IOSPlatform.h"
#import "platform/ios/AppDelegateBridge.h"
#import "service/SDKWrapper.h"
// Extension hub headers are only present when the extension is enabled — the
// build hook copies them into the project. Guard each with __has_include so the
// project compiles cleanly regardless of which extensions are turned on/off.

#if __has_include("FirebaseHub.h")
#import "FirebaseHub.h"   // Firebase extension (auto-inserted)
#define HAS_FIREBASE_HUB 1
#else
#define HAS_FIREBASE_HUB 0
#endif

#if __has_include("AdServiceHub.h")
#import "AdServiceHub.h"   // cocos-google-admob (ADR-0003): native AdMob bridge init
#define HAS_AD_HUB 1
#else
#define HAS_AD_HUB 0
#endif

#if __has_include("IapServiceHub.h")
#import "IapServiceHub.h"  // OpenIAP extension: native StoreKit 2 bridge init
#define HAS_IAP_HUB 1
#else
#define HAS_IAP_HUB 0
#endif

#if __has_include("ShareServiceHub.h")
#import "ShareServiceHub.h"  // Share extension: native UIActivityViewController bridge init
#define HAS_SHARE_HUB 1
#else
#define HAS_SHARE_HUB 0
#endif

#if __has_include("ReviewServiceHub.h")
#import "ReviewServiceHub.h"  // InAppReview extension: native SKStoreReviewController bridge init
#define HAS_REVIEW_HUB 1
#else
#define HAS_REVIEW_HUB 0
#endif

#if __has_include("NotificationServiceHub.h")
#import "NotificationServiceHub.h"  // NotificationScheduler extension: UNUserNotificationCenter bridge init
#define HAS_NOTIFICATION_HUB 1
#else
#define HAS_NOTIFICATION_HUB 0
#endif

#if __has_include("DeeplinkServiceHub.h")
#import "DeeplinkServiceHub.h"  // Deeplink extension: custom URL scheme + Universal Link bridge init
#define HAS_DEEPLINK_HUB 1
#else
#define HAS_DEEPLINK_HUB 0
#endif

@implementation AppDelegate
@synthesize window;
@synthesize appDelegateBridge;

#pragma mark -
#pragma mark Application lifecycle

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
    [[SDKWrapper shared] application:application didFinishLaunchingWithOptions:launchOptions];
#if HAS_FIREBASE_HUB
    [FirebaseHub configure];   // Firebase extension (auto-inserted)
#endif

    appDelegateBridge = [[AppDelegateBridge alloc] init];

    // cocos-google-admob (ADR-0003): start the native AdMob SDK so BannerClient/
    // RewardedAdClient bridge calls have a live native handler. Coexists with Firebase now —
    // both route through JsbBridgeWrapper (admob via the "admob" event channel).
#if HAS_AD_HUB
    [[AdServiceHub sharedInstance] initAdService];
#endif
#if HAS_IAP_HUB
    [[IapServiceHub sharedInstance] initIapService];  // OpenIAP extension: wire StoreKit 2 bridge on the "iap" channel
#endif
#if HAS_SHARE_HUB
    [[ShareServiceHub sharedInstance] initShareService];  // Share extension: wire UIActivityViewController bridge on the "share" channel
#endif
#if HAS_REVIEW_HUB
    [[ReviewServiceHub sharedInstance] initReviewService];  // InAppReview extension: wire SKStoreReviewController bridge on the "inappreview" channel
#endif
#if HAS_NOTIFICATION_HUB
    [[NotificationServiceHub sharedInstance] initNotificationService];  // NotificationScheduler: install UN delegate + wire "notification" channel
#endif
#if HAS_DEEPLINK_HUB
    // Deeplink extension: wire "deeplink" channel + capture cold-start URL before JS starts.
    [[DeeplinkServiceHub sharedInstance] initDeeplinkService];
    [[DeeplinkServiceHub sharedInstance] handleLaunchOptions:launchOptions];
#endif


    // Add the view controller's view to the window and display.
    CGRect bounds = [[UIScreen mainScreen] bounds];
    self.window   = [[UIWindow alloc] initWithFrame:bounds];

    // Should create view controller first, cc::Application will use it.
    _viewController                           = [[ViewController alloc] init];
    _viewController.view                      = [[View alloc] initWithFrame:bounds];
    _viewController.view.contentScaleFactor   = UIScreen.mainScreen.scale;
    _viewController.view.multipleTouchEnabled = true;
    [self.window setRootViewController:_viewController];

    [self.window makeKeyAndVisible];
    [appDelegateBridge application:application didFinishLaunchingWithOptions:launchOptions];

    // ── Launch-image overlay (anti-flash) ─────────────────────────────────────
    // iOS tears down the LaunchScreen storyboard the instant the window becomes visible,
    // but the engine + first scene have NOT finished loading their art yet. Without this
    // the player sees a black flash and image "giật giật" while the boot-screen textures
    // decode. So we re-instantiate the SAME LaunchScreen view, lay it on top of the window,
    // and only fade it out after the game has had time to boot and paint its first frame
    // with art ready. Tune LAUNCH_OVERLAY_HOLD if a slow device still flashes (raise it)
    // or a fast device waits too long (lower it).
    {
        UIViewController *launchVC = [[UIStoryboard storyboardWithName:@"LaunchScreen" bundle:nil] instantiateInitialViewController];
        UIView *launchOverlay = launchVC.view;
        if (launchOverlay != nil) {
            launchOverlay.frame = bounds;
            launchOverlay.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
            launchOverlay.userInteractionEnabled = NO;
            [self.window addSubview:launchOverlay];

            const NSTimeInterval LAUNCH_OVERLAY_HOLD = 1.8;   // seconds on screen before the fade
            dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(LAUNCH_OVERLAY_HOLD * NSEC_PER_SEC)),
                           dispatch_get_main_queue(), ^{
                (void)launchVC;   // retain the VC (and its view) until the fade begins
                [UIView animateWithDuration:0.4
                                 animations:^{ launchOverlay.alpha = 0.0; }
                                 completion:^(BOOL finished){ [launchOverlay removeFromSuperview]; }];
            });
        }
    }
    return YES;
}

- (void)applicationWillResignActive:(UIApplication *)application {
    /*
     Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
     Use this method to pause ongoing tasks, disable timers, and throttle down OpenGL ES frame rates. Games should use this method to pause the game.
     */
    [[SDKWrapper shared] applicationWillResignActive:application];
    [appDelegateBridge applicationWillResignActive:application];
}

- (void)applicationDidBecomeActive:(UIApplication *)application {
    /*
     Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
     */
    [[SDKWrapper shared] applicationDidBecomeActive:application];
    [appDelegateBridge applicationDidBecomeActive:application];
}

- (void)applicationDidEnterBackground:(UIApplication *)application {
    /*
     Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
     If your application supports background execution, called instead of applicationWillTerminate: when the user quits.
     */
    [[SDKWrapper shared] applicationDidEnterBackground:application];
}

- (void)applicationWillEnterForeground:(UIApplication *)application {
    /*
     Called as part of  transition from the background to the inactive state: here you can undo many of the changes made on entering the background.
     */
    [[SDKWrapper shared] applicationWillEnterForeground:application];
}

- (void)applicationWillTerminate:(UIApplication *)application {
    [[SDKWrapper shared] applicationWillTerminate:application];
    [appDelegateBridge applicationWillTerminate:application];
}

#pragma mark -
#pragma mark Memory management

- (void)applicationDidReceiveMemoryWarning:(UIApplication *)application {
    [[SDKWrapper shared] applicationDidReceiveMemoryWarning:application];
}

// Deeplink extension: custom URL scheme — app open or resume from background.
- (BOOL)application:(UIApplication *)application
            openURL:(NSURL *)url
            options:(NSDictionary<UIApplicationOpenURLOptionsKey, id> *)options {
#if HAS_DEEPLINK_HUB
    [[DeeplinkServiceHub sharedInstance] handleOpenURL:url];
#endif
    return YES;
}

// Deeplink extension: Universal Links — app open or resume from background.
- (BOOL)application:(UIApplication *)application
    continueUserActivity:(NSUserActivity *)userActivity
      restorationHandler:(void (^)(NSArray<id<UIUserActivityRestoring>> *))restorationHandler {
#if HAS_DEEPLINK_HUB
    [[DeeplinkServiceHub sharedInstance] handleUserActivity:userActivity];
#endif
    return YES;
}

@end
