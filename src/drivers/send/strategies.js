
import { CONSTANTS } from '../../conf';
import { isSameDomain, isSameTopWindow } from '../../lib';
import { emulateIERestrictions } from '../../compat';
import { sendBridgeMessage } from '../../bridge';

export let SEND_MESSAGE_STRATEGIES = {

    [ CONSTANTS.SEND_STRATEGIES.POST_MESSAGE ](win, serializedMessage, domain) {

        emulateIERestrictions(window, win);

        if (domain && domain.indexOf(CONSTANTS.MOCK_PROTOCOL) === 0) {
            domain = `${win.location.protocol}//${win.location.host}`;
        }

        if (domain && domain.indexOf(CONSTANTS.FILE_PROTOCOL) === 0) {
            domain = `*`;
        }

        return win.postMessage(serializedMessage, domain);
    },

    [ CONSTANTS.SEND_STRATEGIES.BRIDGE ](win, serializedMessage, domain) {

        if (isSameDomain(win)) {
            throw new Error(`Post message through bridge disabled between same domain windows`);
        }

        if (isSameTopWindow(window, win) !== false) {
            throw new Error(`Can only use bridge to communicate between two different windows, not between frames`);
        }

        return sendBridgeMessage(win, serializedMessage, domain);
    },

    [ CONSTANTS.SEND_STRATEGIES.GLOBAL ](win, serializedMessage, domain) {

        if (!isSameDomain(win)) {
            throw new Error(`Post message through global disabled between different domain windows`);
        }

        if (isSameTopWindow(window, win) !== false) {
            throw new Error(`Can only use global to communicate between two different windows, not between frames`);
        }

        let foreignGlobal = win[CONSTANTS.WINDOW_PROPS.POSTROBOT];
        
        if (!foreignGlobal) {
            throw new Error(`Can not find postRobot global on foreign window`);
        }

        return foreignGlobal.receiveMessage({
            source: window,
            origin: domain,
            data: serializedMessage
        });
    }
};