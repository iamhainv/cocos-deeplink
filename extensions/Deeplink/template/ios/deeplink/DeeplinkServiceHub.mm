/**
 * DeeplinkServiceHub.mm — Deeplink extension iOS bridge singleton.
 *
 * Ported from godot-deeplink-main/ios/src/:
 *   deeplink_service.mm   (URL ingestion + delegate methods)
 *   model/deeplink_url.mm (NSURL decomposition into property bag)
 *   gdp_converter.mm      (data conversion — replaced with JSON serialisation)
 *
 * Deviations from the Godot source (and rationale):
 *
 *   1. No Godot signal layer.  Events are emitted as JSON over JsbBridgeWrapper
 *      on the "deeplink" channel, matching sibling extensions (Notification,
 *      Share, IAP, Review, AdMob).
 *
 *   2. JSON serialisation instead of Godot Dictionary.  gdp_converter.mm
 *      converts NSArray/NSDictionary to Godot Array/Dictionary.  Here we
 *      build an NSDictionary and serialise it with NSJSONSerialization.
 *      Nil NSURL properties are omitted entirely rather than emitting an
 *      empty string, giving JS optional fields exactly as typed in Types.ts.
 *      Exception: "url" (absoluteString), "scheme", "host", and "path" are
 *      always emitted as "" when nil to match the TypeScript interface where
 *      those four fields are required non-optional strings.
 *
 *   3. Buffer-then-flush cold-start pattern from NotificationServiceHub.
 *      The Godot source calls plugin->call_deferred("emit_signal", ...) which
 *      defers until Godot's main loop resumes.  The Cocos equivalent stores the
 *      parsed URL in _pendingLaunchUrl and emits it 500 ms after JS calls
 *      "initialize" — the same window used by NotificationServiceHub.
 *
 *   4. UIWindowSceneDelegate (scene: willConnectToSession:, scene: openURLContexts:,
 *      scene: continueUserActivity:) NOT implemented.  The Cocos Creator 3.8.x
 *      native iOS template does not use UIWindowSceneDelegate; all lifecycle
 *      events flow through UIApplicationDelegate in AppDelegate.mm.  If a
 *      future Cocos version adopts scene-based lifecycle, add those methods here.
 *
 *   5. isDomainAssociated and navigateToOpenByDefaultSettings return E_NOT_SUPPORTED
 *      — they are Android-only concepts (Intent verification / default app settings).
 *
 * Threading:
 *   All JsbBridgeWrapper dispatchEventToScript: calls are marshalled to the main
 *   queue, matching FirebaseHub and other sibling bridges.  URL receipt from
 *   UIApplicationDelegate callbacks arrives on the main thread; cold-start
 *   processing in handleLaunchOptions: also runs on the main thread.
 */

#import "DeeplinkServiceHub.h"

#import "platform/apple/JsbBridgeWrapper.h"

// ---------------------------------------------------------------------------
// Channel name (must match Bridge.ts: channel "deeplink")
// ---------------------------------------------------------------------------

static NSString *const kDeeplinkChannel = @"deeplink";

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

static NSString *const kErrNotSupported = @"E_NOT_SUPPORTED";

// ---------------------------------------------------------------------------
// Wire-protocol helpers
// ---------------------------------------------------------------------------

/**
 * Build a success-response JSON string for the given call id.
 * @param callId  The numeric JS call identifier.
 * @param data    The response data dictionary (may be empty @{}).
 */
static NSString *DLResponseSuccess(NSInteger callId, NSDictionary *data) {
    NSDictionary *envelope = @{
        @"kind"    : @"response",
        @"id"      : @(callId),
        @"success" : @YES,
        @"data"    : data,
    };
    NSData *bytes = [NSJSONSerialization dataWithJSONObject:envelope options:0 error:nil];
    return bytes ? [[NSString alloc] initWithData:bytes encoding:NSUTF8StringEncoding] : @"{}";
}

/**
 * Build a failure-response JSON string for the given call id.
 * @param callId   The numeric JS call identifier.
 * @param code     Short error code string (e.g. "E_NOT_SUPPORTED").
 * @param message  Human-readable error description.
 */
static NSString *DLResponseError(NSInteger callId, NSString *code, NSString *message) {
    NSDictionary *envelope = @{
        @"kind"    : @"response",
        @"id"      : @(callId),
        @"success" : @NO,
        @"error"   : @{ @"code": code, @"message": message },
    };
    NSData *bytes = [NSJSONSerialization dataWithJSONObject:envelope options:0 error:nil];
    return bytes ? [[NSString alloc] initWithData:bytes encoding:NSUTF8StringEncoding] : @"{}";
}

/**
 * Build an event JSON string.
 * Note: Deeplink Bridge.ts _WireEvent uses "payload" (not "data") for events.
 * @param name     Event name (e.g. "deeplinkReceived").
 * @param payload  Event payload dictionary.
 */
static NSString *DLEvent(NSString *name, NSDictionary *payload) {
    NSDictionary *envelope = @{
        @"kind"    : @"event",
        @"name"    : name,
        @"payload" : payload,
    };
    NSData *bytes = [NSJSONSerialization dataWithJSONObject:envelope options:0 error:nil];
    return bytes ? [[NSString alloc] initWithData:bytes encoding:NSUTF8StringEncoding] : @"{}";
}

/**
 * Marshal a dispatchEventToScript call to the main queue.
 * UIApplicationDelegate callbacks arrive on the main thread, but we marshal
 * explicitly to keep the pattern consistent with sibling hubs.
 */
static void DLEmit(NSString *channel, NSString *json) {
    dispatch_async(dispatch_get_main_queue(), ^{
        [[JsbBridgeWrapper sharedInstance] dispatchEventToScript:channel arg:json];
    });
}

// ---------------------------------------------------------------------------
// Parse helpers
// ---------------------------------------------------------------------------

/** Parse a JSON arg string into an NSDictionary; returns @{} on failure. */
static NSDictionary *DLParse(NSString *json) {
    if (json.length == 0) return @{};
    NSData *d = [json dataUsingEncoding:NSUTF8StringEncoding];
    if (!d) return @{};
    id obj = [NSJSONSerialization JSONObjectWithData:d options:0 error:nil];
    return [obj isKindOfClass:[NSDictionary class]] ? obj : @{};
}

// ---------------------------------------------------------------------------
// NSURL → DeeplinkUrl JSON
//
// Mirrors deeplink_url.mm -buildRawData but:
//   * Uses camelCase keys (matching Types.ts DeeplinkUrl interface).
//   * Omits nil/empty optional fields rather than inserting empty strings
//     (matching the TypeScript optional field semantics).
//   * Always emits "url", "scheme", "host", "path" (required non-optional
//     strings in Types.ts) as "" when the NSURL property returns nil.
// ---------------------------------------------------------------------------

/**
 * Decompose an NSURL into a JSON-serialisable NSDictionary following the
 * DeeplinkUrl interface in assets/Types.ts.
 *
 * @param url  The URL to decompose.  Must not be nil (guarded by callers).
 * @return     An NSDictionary safe to pass to NSJSONSerialization.
 */
static NSDictionary *DLUrlToDict(NSURL *url) {
    NSMutableDictionary *d = [NSMutableDictionary dictionary];

    // Required non-optional fields — emit "" when nil.
    d[@"url"]    = url.absoluteString ?: @"";
    d[@"scheme"] = url.scheme         ?: @"";
    d[@"host"]   = url.host           ?: @"";
    d[@"path"]   = url.path           ?: @"";

    // Optional fields — omit when nil/empty.
    if (url.user.length)          d[@"user"]           = url.user;
    if (url.password.length)      d[@"password"]       = url.password;
    if (url.port)                 d[@"port"]           = url.port;     // NSNumber — JSON number
    if (url.pathExtension.length) d[@"pathExtension"]  = url.pathExtension;
    if (url.pathComponents.count) d[@"pathComponents"] = url.pathComponents;
    if (url.query.length)         d[@"query"]          = url.query;
    if (url.fragment.length)      d[@"fragment"]       = url.fragment;

    return [d copy];
}

// ---------------------------------------------------------------------------
// DeeplinkServiceHub implementation
// ---------------------------------------------------------------------------

@interface DeeplinkServiceHub ()

/** Guards -initDeeplinkService against multiple calls. */
@property (nonatomic, assign) BOOL _serviceRegistered;

/**
 * The last deep-link URL received, stored as a JSON-ready NSDictionary.
 * Returned by the "getLink" method; cleared by "clearData".
 * Nil when no link has been received since last clearData (or ever).
 */
@property (nonatomic, copy, nullable) NSDictionary *_lastLinkDict;

/**
 * Cold-start URL buffer.
 * When the app is launched by a deep-link, handleLaunchOptions: fires before
 * the JS engine is ready.  The parsed URL dict is stored here and flushed
 * 500 ms after the JS "initialize" call, matching NotificationServiceHub's
 * _pendingLaunchEventData pattern.
 */
@property (nonatomic, copy, nullable) NSDictionary *_pendingLaunchDict;

@end

@implementation DeeplinkServiceHub

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

+ (instancetype)sharedInstance {
    static DeeplinkServiceHub *s = nil;
    static dispatch_once_t once;
    dispatch_once(&once, ^{ s = [[DeeplinkServiceHub alloc] init]; });
    return s;
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

/**
 * Register the "deeplink" JsbBridgeWrapper channel listener and prepare state.
 * Called once from AppDelegate -application:didFinishLaunchingWithOptions:.
 * Idempotent: subsequent calls return immediately.
 */
- (void)initDeeplinkService {
    if (self._serviceRegistered) return;
    self._serviceRegistered = YES;

    // ── Register JsbBridgeWrapper "deeplink" channel listener ───────────────
    // JsbBridgeWrapper is MRC and calls [listener release] on the block after
    // adding it to its internal array (engine source JsbBridgeWrapper.mm:58-69).
    // An inline block literal passed to addScriptEventListener: is +0 (ARC does
    // not retain it before the call), so the engine's release over-frees it →
    // dangling block → EXC_BAD_ACCESS on the next triggerEvent call.  Keep a
    // strong static reference so the block survives the engine's release.
    __weak __typeof__(self) wself = self;
    static OnScriptEventListener sDeeplinkListener = nil;
    sDeeplinkListener = ^(NSString *arg) {
        DeeplinkServiceHub *hub = wself;
        if (!hub) { return; }
        [hub _handleBridgeCall:DLParse(arg)];
    };
    JsbBridgeWrapper *bridge = [JsbBridgeWrapper sharedInstance];
    [bridge addScriptEventListener:kDeeplinkChannel listener:sDeeplinkListener];

    NSLog(@"[DeeplinkServiceHub] initDeeplinkService complete");
}

// ---------------------------------------------------------------------------
// AppDelegate entry points
// ---------------------------------------------------------------------------

/**
 * Handle a cold-start deep-link encoded in launchOptions.
 *
 * Checks UIApplicationLaunchOptionsURLKey first (custom scheme), then falls
 * through to UIApplicationLaunchOptionsUserActivityDictionaryKey (Universal
 * Link), mirroring godot-deeplink deeplink_service.mm didFinishLaunching
 * exactly (all three nested branches).
 */
- (void)handleLaunchOptions:(nullable NSDictionary *)launchOptions {
    if (!launchOptions) return;

    // Branch 1: custom URL scheme cold-start.
    NSURL *url = launchOptions[UIApplicationLaunchOptionsURLKey];
    if (url) {
        [self _processURL:url fromSource:@"handleLaunchOptions (URLKey)" isColdStart:YES];
        return;
    }

    // Branch 2 & 3: Universal Link cold-start via UserActivity dictionary.
    NSDictionary *userActivityDict =
        launchOptions[UIApplicationLaunchOptionsUserActivityDictionaryKey];
    if (userActivityDict) {
        // Branch 2: some platforms put the URL directly in the activity dict.
        NSURL *activityUrl = userActivityDict[UIApplicationLaunchOptionsURLKey];
        if (activityUrl) {
            [self _processURL:activityUrl
                   fromSource:@"handleLaunchOptions (UserActivity URLKey)"
                  isColdStart:YES];
            return;
        }

        // Branch 3: standard path — extract NSUserActivity and use webpageURL.
        NSUserActivity *userActivity =
            userActivityDict[@"UIApplicationLaunchOptionsUserActivityKey"];
        if (userActivity &&
            [userActivity.activityType isEqualToString:NSUserActivityTypeBrowsingWeb] &&
            userActivity.webpageURL) {
            [self _processURL:userActivity.webpageURL
                   fromSource:@"handleLaunchOptions (UserActivity Web)"
                  isColdStart:YES];
        }
    }
}

/**
 * Handle a URL opened while the app is running or resuming from background.
 * Covers custom URL schemes; AppDelegate routes here from -application:openURL:options:.
 */
- (void)handleOpenURL:(NSURL *)url {
    if (!url) return;
    [self _processURL:url fromSource:@"handleOpenURL" isColdStart:NO];
}

/**
 * Handle a Universal Link continuation.
 * Only NSUserActivityTypeBrowsingWeb activities are processed.
 */
- (void)handleUserActivity:(NSUserActivity *)userActivity {
    if (![userActivity.activityType isEqualToString:NSUserActivityTypeBrowsingWeb]) return;
    if (!userActivity.webpageURL) return;
    [self _processURL:userActivity.webpageURL fromSource:@"handleUserActivity" isColdStart:NO];
}

// ---------------------------------------------------------------------------
// Core URL processing
// ---------------------------------------------------------------------------

/**
 * Parse the NSURL, store it as the last link, then either buffer or emit
 * the "deeplinkReceived" event depending on whether JS has initialised.
 *
 * @param url           The URL to process.  Nil is tolerated and logged.
 * @param source        Debug tag identifying the originating AppDelegate path.
 * @param isColdStart   YES when the app was not previously running; the event
 *                      must be buffered until after JS "initialize".
 */
- (void)_processURL:(NSURL *)url fromSource:(NSString *)source isColdStart:(BOOL)isColdStart {
    if (!url) {
        NSLog(@"[DeeplinkServiceHub] _processURL: nil URL from source: %@", source);
        return;
    }

    BOOL isCustomScheme = (![url.scheme isEqualToString:@"http"] &&
                           ![url.scheme isEqualToString:@"https"]);
    NSLog(@"[DeeplinkServiceHub] %@ received via [%@]: %@",
          isCustomScheme ? @"Custom scheme" : @"Universal Link",
          source,
          url.absoluteString);

    NSDictionary *dict = DLUrlToDict(url);
    self._lastLinkDict = dict;

    if (isColdStart) {
        // Store for flush on first JS "initialize" call.
        self._pendingLaunchDict = dict;
        NSLog(@"[DeeplinkServiceHub] buffering cold-start deeplinkReceived event");
    } else {
        // App is already running — emit immediately.
        DLEmit(kDeeplinkChannel, DLEvent(@"deeplinkReceived", dict));
    }
}

// ---------------------------------------------------------------------------
// Bridge dispatch
// ---------------------------------------------------------------------------

/**
 * Route an incoming JS call to the appropriate handler method.
 * Envelope shape: {"id":int, "method":"<name>", "args":{...}}
 */
- (void)_handleBridgeCall:(NSDictionary *)envelope {
    NSInteger callId = [envelope[@"id"] integerValue];
    NSString *method = envelope[@"method"] ?: @"";
    NSDictionary *args = [envelope[@"args"] isKindOfClass:[NSDictionary class]]
                         ? envelope[@"args"] : @{};

    if ([method isEqualToString:@"initialize"]) {
        [self _handleInitialize:callId args:args];
    } else if ([method isEqualToString:@"getLink"]) {
        [self _handleGetLink:callId args:args];
    } else if ([method isEqualToString:@"clearData"]) {
        [self _handleClearData:callId args:args];
    } else if ([method isEqualToString:@"isDomainAssociated"]
            || [method isEqualToString:@"navigateToOpenByDefaultSettings"]) {
        // Android-only — return E_NOT_SUPPORTED on iOS.
        DLEmit(kDeeplinkChannel,
               DLResponseError(callId, kErrNotSupported,
                   [NSString stringWithFormat:@"'%@' is not supported on iOS", method]));
    } else {
        NSLog(@"[DeeplinkServiceHub] Unknown method: %@", method);
        DLEmit(kDeeplinkChannel,
               DLResponseError(callId, @"E_UNKNOWN_METHOD",
                   [NSString stringWithFormat:@"Unknown method '%@'", method]));
    }
}

// ---------------------------------------------------------------------------
// Method handlers
// ---------------------------------------------------------------------------

/**
 * initialize {} → {}
 *
 * Responds immediately with success, then flushes any buffered cold-start
 * "deeplinkReceived" event 500 ms later — giving JS time to register its
 * "deeplinkReceived" handler after processing the response.
 *
 * Pattern mirrors NotificationServiceHub -_handleInitialize:args:.
 */
- (void)_handleInitialize:(NSInteger)callId args:(NSDictionary *)args {
    // Respond immediately.
    DLEmit(kDeeplinkChannel, DLResponseSuccess(callId, @{}));

    // Flush buffered cold-start link (if any).
    NSDictionary *pending = self._pendingLaunchDict;
    if (pending) {
        self._pendingLaunchDict = nil;
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.5 * NSEC_PER_SEC)),
                       dispatch_get_main_queue(), ^{
            NSLog(@"[DeeplinkServiceHub] Flushing buffered cold-start deeplinkReceived event");
            DLEmit(kDeeplinkChannel, DLEvent(@"deeplinkReceived", pending));
        });
    }
}

/**
 * getLink {} → DeeplinkUrl json (empty object fields when no link stored)
 *
 * Returns the last stored DeeplinkUrl dictionary.  When no link has ever been
 * received (or after clearData), returns an empty object {} so JS callers can
 * check for an empty "url" field rather than null.
 */
- (void)_handleGetLink:(NSInteger)callId args:(NSDictionary *)args {
    NSDictionary *result = self._lastLinkDict ?: @{};
    DLEmit(kDeeplinkChannel, DLResponseSuccess(callId, result));
}

/**
 * clearData {} → {}
 *
 * Nils the stored last link and any buffered cold-start link.  Subsequent
 * getLink calls return an empty object until a new URL is received.
 */
- (void)_handleClearData:(NSInteger)callId args:(NSDictionary *)args {
    self._lastLinkDict      = nil;
    self._pendingLaunchDict = nil;
    NSLog(@"[DeeplinkServiceHub] clearData — last link and pending launch link cleared");
    DLEmit(kDeeplinkChannel, DLResponseSuccess(callId, @{}));
}

@end
