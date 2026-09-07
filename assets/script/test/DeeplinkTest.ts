/**
 * DeeplinkTest — runtime demo for the Cocos Deeplink extension.
 *
 * Builds its whole UI in code (no scene-baked buttons) so the example is
 * fully readable in a single file. Attach this component to any Node in a
 * scene with a UI camera (see assets/scene/main.scene) and it will lay out:
 *
 *   - A "Cold-start link" panel — shows the URL the app was launched with,
 *     if any (empty when the app was opened normally, e.g. from the home
 *     screen icon).
 *   - A "Copy" button — copies the cold-start link to the system clipboard
 *     via `sys.copyTextToClipboard()`.
 *   - A live log — appends every link received via the `deeplinkReceived`
 *     event while the app keeps running (foreground/background resume).
 *
 * IMPORTANT ordering (see DeeplinkClient.ts docs): `onDeeplinkReceived()`
 * handlers must be registered BEFORE `initialize()` is called, because the
 * native side buffers the cold-start URL and flushes it synchronously
 * during `initialize()`.
 *
 * On web preview / editor (non-native), the extension's bridge rejects every
 * call with `{ code: 'E_NOT_SUPPORTED' }` — this component just catches that
 * and shows a friendly status message instead of crashing.
 */

import { _decorator, Component, Node, Label, Graphics, Color, UITransform, Vec3, sys } from 'cc';
import { deeplink } from 'db://deeplink/index';
import type { DeeplinkUrl, DeeplinkError } from 'db://deeplink/index';

const { ccclass } = _decorator;

const TAG = '[DeeplinkTest]';

/** Maximum number of entries kept in the on-screen live log. */
const MAX_LOG_ENTRIES = 8;

@ccclass('DeeplinkTest')
export class DeeplinkTest extends Component {

    private _statusLabel: Label | null = null;
    private _coldStartLabel: Label | null = null;
    private _logLabel: Label | null = null;

    /** The most recently known cold-start / current link, for the Copy button. */
    private _coldStartUrl: string = '';

    /** Whether any `deeplinkReceived` event has fired yet. */
    private _receivedAnyLink: boolean = false;

    private _logLines: string[] = [];

    onLoad() {
        this._buildUI();
        this._startDeeplinkFlow();
    }

    // -----------------------------------------------------------------
    // UI construction (no scene-baked prefabs — everything built in code)
    // -----------------------------------------------------------------

    private _buildUI(): void {
        const root = this.node;
        const rootUi = root.getComponent(UITransform) ?? root.addComponent(UITransform);
        rootUi.setContentSize(640, 720);

        this._addLabel(root, 'Cocos Deeplink Demo', 0, 300, 28, true);

        this._statusLabel = this._addLabel(
            root,
            sys.isNative
                ? 'Waiting for deeplink.initialize()...'
                : 'Web/editor preview — native deep links are disabled here.\nBuild to Android/iOS to test.',
            0, 250, 18, false,
        );

        this._addLabel(root, 'Cold-start link (app launch URL):', 0, 190, 18, true);
        this._coldStartLabel = this._addLabel(root, '(none yet)', 0, 150, 16, false);

        this._addButton(root, 'Copy Link', 90, () => this._onCopyLink());

        this._addLabel(root, 'Live log (links received while running):', 0, 20, 18, true);
        this._logLabel = this._addLabel(root, '(no events yet)', 0, -140, 14, false);
        const logUi = this._logLabel.node.getComponent(UITransform);
        if (logUi) {
            logUi.setContentSize(600, 260);
        }
        this._logLabel.verticalAlign = Label.VerticalAlign.TOP;
        this._logLabel.overflow = Label.Overflow.CLAMP;
    }

    private _addLabel(parent: Node, text: string, x: number, y: number, fontSize: number, bold: boolean): Label {
        const node = new Node('Label');
        parent.addChild(node);
        node.setPosition(new Vec3(x, y, 0));
        const ui = node.addComponent(UITransform);
        ui.setContentSize(600, 80);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 6;
        label.isBold = bold;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.RESIZE_HEIGHT;
        label.color = new Color(255, 255, 255, 255);
        return label;
    }

    private _addButton(parent: Node, text: string, y: number, onClick: () => void): Node {
        const node = new Node(`Button_${text.replace(/\s+/g, '')}`);
        parent.addChild(node);
        node.setPosition(new Vec3(0, y, 0));

        const ui = node.addComponent(UITransform);
        ui.setContentSize(320, 64);

        const graphics = node.addComponent(Graphics);
        graphics.fillColor = new Color(43, 108, 176, 255);
        graphics.roundRect(-160, -32, 320, 64, 12);
        graphics.fill();

        const labelNode = new Node('Label');
        node.addChild(labelNode);
        const labelUi = labelNode.addComponent(UITransform);
        labelUi.setContentSize(320, 64);
        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = 22;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.color = new Color(255, 255, 255, 255);

        node.on(Node.EventType.TOUCH_END, () => onClick(), this);

        return node;
    }

    private _setStatus(text: string): void {
        if (this._statusLabel) {
            this._statusLabel.string = text;
        }
        console.log(TAG, text);
    }

    // -----------------------------------------------------------------
    // Deeplink flow
    // -----------------------------------------------------------------

    private async _startDeeplinkFlow(): Promise<void> {
        // Register the handler BEFORE calling initialize() — the native side
        // flushes the buffered cold-start URL (if any) synchronously during
        // the initialize() call, so a handler registered afterwards would
        // miss it.
        deeplink.onDeeplinkReceived((url) => this._onDeeplinkReceived(url));

        try {
            await deeplink.initialize();
            this._setStatus('deeplink.initialize() done — ready to receive links.');

            if (!this._receivedAnyLink && this._coldStartLabel) {
                this._coldStartLabel.string = '(app opened normally — no launch link)';
            }
        } catch (e) {
            this._reportError('initialize()', e as DeeplinkError);
        }
    }

    private _onDeeplinkReceived(url: DeeplinkUrl): void {
        const isFirst = !this._receivedAnyLink;
        this._receivedAnyLink = true;

        if (isFirst && this._coldStartLabel) {
            // First event delivered during initialize() is the cold-start URL.
            this._coldStartUrl = url.url;
            this._coldStartLabel.string = url.url || '(empty)';
        }

        this._appendLog(`${isFirst ? '[cold-start]' : '[live]'} ${url.url}`);
        console.log(TAG, 'deeplinkReceived', JSON.stringify(url));
    }

    private _appendLog(line: string): void {
        const timestamp = new Date().toLocaleTimeString();
        this._logLines.unshift(`${timestamp}  ${line}`);
        if (this._logLines.length > MAX_LOG_ENTRIES) {
            this._logLines.length = MAX_LOG_ENTRIES;
        }
        if (this._logLabel) {
            this._logLabel.string = this._logLines.join('\n');
        }
    }

    // -----------------------------------------------------------------
    // Button handlers
    // -----------------------------------------------------------------

    private _onCopyLink(): void {
        if (!this._coldStartUrl) {
            this._setStatus('Nothing to copy yet — no link received.');
            return;
        }
        try {
            sys.copyTextToClipboard(this._coldStartUrl);
            this._setStatus(`Copied to clipboard: ${this._coldStartUrl}`);
        } catch (e) {
            this._setStatus(`Copy failed: ${(e as Error)?.message ?? String(e)}`);
        }
    }

    private _reportError(what: string, err: DeeplinkError): void {
        if (err && err.code === 'E_NOT_SUPPORTED') {
            this._setStatus(`${what}: native only — build to Android/iOS to try this.`);
            return;
        }
        const message = (err && err.message) || String(err);
        const code = (err && err.code) || 'E_UNKNOWN';
        this._setStatus(`${what} failed [${code}]: ${message}`);
    }
}
