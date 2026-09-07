/**
 * DeeplinkServiceHub.h — Deeplink extension iOS bridge singleton interface.
 *
 * Registers a JsbBridgeWrapper listener on the "deeplink" channel and handles
 * custom URL scheme openings and Universal Link continuations forwarded from
 * AppDelegate.  The stored last-received DeeplinkUrl is returned to JS via the
 * "getLink" method; "clearData" nils it.
 *
 * Cold-start buffering:
 *   When the app is launched via a deep-link (cold start), AppDelegate calls
 *   -handleLaunchOptions: before the JS engine is ready.  The parsed DeeplinkUrl
 *   is stored internally.  On the first JS "initialize" call the "deeplinkReceived"
 *   event is flushed with a 500 ms main-queue delay — the same pattern used by
 *   NotificationServiceHub — to ensure the JS listener has registered before the
 *   event fires.
 *
 * Required iOS project configuration (inject via build hook, not this file):
 *   Custom URL scheme:
 *     Add a CFBundleURLTypes entry in Info.plist with CFBundleURLSchemes = [<your-scheme>].
 *   Universal Links:
 *     1. Add com.apple.developer.associated-domains = ["applinks:<your-domain>"] to
 *        the app's entitlements file.
 *     2. Host an Apple App Site Association (AASA) file at
 *        https://<your-domain>/.well-known/apple-app-site-association.
 *
 * Usage (AppDelegate.mm):
 *   #import "DeeplinkServiceHub.h"
 *   // In -application:didFinishLaunchingWithOptions: (after sibling hub init lines):
 *   [[DeeplinkServiceHub sharedInstance] initDeeplinkService];
 *   [[DeeplinkServiceHub sharedInstance] handleLaunchOptions:launchOptions];
 *   // In -application:openURL:options::
 *   [[DeeplinkServiceHub sharedInstance] handleOpenURL:url];
 *   // In -application:continueUserActivity:restorationHandler::
 *   [[DeeplinkServiceHub sharedInstance] handleUserActivity:userActivity];
 *
 * Wire protocol (must match extensions/Deeplink/assets/core/Bridge.ts):
 *   JS → native  : {"id":int,"method":"<method>","args":{...}}
 *   native → JS  : {"kind":"response","id":N,"success":true,"data":{...}}
 *                  {"kind":"response","id":N,"success":false,"error":{"code":"...","message":"..."}}
 *   native → JS  : {"kind":"event","name":"deeplinkReceived","payload":{DeeplinkUrl}}
 *
 * DeeplinkUrl JSON payload keys (camelCase; nil NSURL properties are omitted):
 *   url, scheme, user, password, host, port (number), path, pathExtension,
 *   pathComponents (array), query, fragment
 */

#pragma once

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * DeeplinkServiceHub — singleton owning the "deeplink" JS-native bridge channel.
 *
 * Lifecycle: call -initDeeplinkService and -handleLaunchOptions: once from AppDelegate
 * -application:didFinishLaunchingWithOptions:.  Forward URL-open and user-activity
 * callbacks from AppDelegate as documented above.  All methods are thread-safe.
 */
@interface DeeplinkServiceHub : NSObject

/** Returns the singleton instance. */
+ (instancetype)sharedInstance;

/**
 * Register the "deeplink" JsbBridgeWrapper channel listener and prepare internal state.
 * Must be called from the main thread during app launch.  Idempotent.
 */
- (void)initDeeplinkService;

/**
 * Handle a cold-start deep-link encoded in launchOptions.
 *
 * Checks both UIApplicationLaunchOptionsURLKey (custom scheme) and
 * UIApplicationLaunchOptionsUserActivityDictionaryKey (Universal Link) following
 * the same logic as godot-deeplink deeplink_service.mm didFinishLaunching.
 * Stores the parsed DeeplinkUrl and queues the buffered "deeplinkReceived" event
 * for delivery on the first JS "initialize" call.
 *
 * @param launchOptions  The launchOptions dictionary from
 *                       -application:didFinishLaunchingWithOptions:. May be nil.
 */
- (void)handleLaunchOptions:(nullable NSDictionary *)launchOptions;

/**
 * Handle a URL opened while the app is running or resuming from background.
 * Called from -application:openURL:options:.  Covers custom URL schemes and any
 * direct NSURL received by AppDelegate (including Universal Links on older iOS
 * versions that fall back to openURL).
 *
 * @param url  The NSURL forwarded from UIApplicationDelegate.  Must not be nil.
 */
- (void)handleOpenURL:(NSURL *)url;

/**
 * Handle a Universal Link continuation forwarded from
 * -application:continueUserActivity:restorationHandler:.
 * Only NSUserActivityTypeBrowsingWeb activities are processed; all others are ignored.
 *
 * @param userActivity  The NSUserActivity forwarded from UIApplicationDelegate.
 */
- (void)handleUserActivity:(NSUserActivity *)userActivity;

@end

NS_ASSUME_NONNULL_END
