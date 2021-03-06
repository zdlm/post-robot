
import { CONFIG, CONSTANTS } from '../conf';
import { util, promise, log, onWindowReady, getFrameByName } from '../lib';
import { global } from '../global';
import { on } from '../interface';
import { receiveMessage } from '../drivers';

global.bridges = global.bridges || {};

import { getBridgeName, documentBodyReady, registerRemoteSendMessage, registerRemoteWindow } from './common';

function listenForRegister(source, domain) {
    on(CONSTANTS.POST_MESSAGE_NAMES.OPEN_TUNNEL, { source, domain }, ({ origin, data }) => {

        if (origin !== domain) {
            throw new Error(`Domain ${domain} does not match origin ${origin}`);
        }

        if (!data.name) {
            throw new Error(`Register window expected to be passed window name`);
        }

        if (!data.sendMessage) {
            throw new Error(`Register window expected to be passed sendMessage method`);
        }

        let winDetails = global.popupWindows[data.name];

        if (!winDetails) {
            throw new Error(`Window with name ${data.name} does not exist, or was not opened by this window`);
        }

        if (!winDetails.domain) {
            throw new Error(`We do not have a registered domain for window ${data.name}`);
        }

        if (winDetails.domain !== origin) {
            throw new Error(`Message origin ${origin} does not matched registered window origin ${winDetails.domain}`);
        }

        registerRemoteSendMessage(winDetails.win, domain, data.sendMessage);

        return {
            sendMessage(message) {

                if (!window || window.closed) {
                    return;
                }

                receiveMessage({
                    data:   message,
                    origin: winDetails.domain,
                    source: winDetails.win
                });
            }
        };
    });
}

function openBridgeFrame(name, url) {

    log.debug(`Opening bridge:`, name, url);

    let iframe = document.createElement(`iframe`);

    iframe.setAttribute(`name`, name);
    iframe.setAttribute(`id`,   name);

    iframe.setAttribute(`style`, `display: none; margin: 0; padding: 0; border: 0px none; overflow: hidden;`);
    iframe.setAttribute(`frameborder`, `0`);
    iframe.setAttribute(`border`, `0`);
    iframe.setAttribute(`scrolling`, `no`);
    iframe.setAttribute(`allowTransparency`, `true`);

    iframe.setAttribute(`tabindex`, `-1`);
    iframe.setAttribute(`hidden`, `true`);
    iframe.setAttribute(`title`, ``);
    iframe.setAttribute(`role`, `presentation`);

    iframe.src = url;

    return iframe;
}

export function openBridge(url, domain) {

    domain = domain || util.getDomainFromUrl(url);

    if (global.bridges[domain]) {
        return global.bridges[domain];
    }

    return global.clean.setItem(global.bridges, domain, promise.run(() => {

        if (util.getDomain() === domain) {
            throw new Error(`Can not open bridge on the same domain as current domain: ${domain}`);
        }

        let name  = getBridgeName(domain);
        let frame = getFrameByName(window, name);

        if (frame) {
            throw new Error(`Frame with name ${name} already exists on page`);
        }

        let iframe = openBridgeFrame(name, url);

        return documentBodyReady.then(body => {

            return new promise.Promise((resolve, reject) => {

                setTimeout(resolve, 1);

            }).then(() => {

                body.appendChild(iframe);

                global.clean.register('bridgeFrames', () => {
                    body.removeChild(iframe);
                    delete global.bridges[domain];
                });

                let bridge = iframe.contentWindow;

                listenForRegister(bridge, domain);

                return new promise.Promise((resolve, reject) => {

                    iframe.onload = resolve;
                    iframe.onerror = reject;

                }).then(() => {

                    return onWindowReady(bridge, CONFIG.BRIDGE_TIMEOUT, `Bridge ${url}`);

                }).then(() => {

                    return bridge;
                });
            });
        });
    }));
}

export function destroyBridges() {
    return global.clean.run('bridgeFrames');
}

global.popupWindows = global.popupWindows || {};

let windowOpen = window.open;

window.open = function(url, name, options, last) {

    let domain = url;

    if (url && url.indexOf(CONSTANTS.MOCK_PROTOCOL) === 0) {
        [ domain, url ] = url.split('|');
    }

    if (domain) {
        domain = util.getDomainFromUrl(domain);
    }

    let win = windowOpen.call(this, url, name, options, last);

    if (url) {
        registerRemoteWindow(win);
    }

    if (name) {
        global.clean.setItem(global.popupWindows, name, { win, domain });
    }

    return win;
};

export function linkUrl(win, url) {

    for (let name of Object.keys(global.popupWindows)) {
        let winOptions = global.popupWindows[name];

        if (winOptions.win === win) {
            winOptions.domain = util.getDomainFromUrl(url);

            registerRemoteWindow(win);

            break;
        }
    }
}
