/**
 * (c) 2013 Rob Wu <gwnRob@gmail.com>
 * Implementation of chrome.browserAction for Jetpack Add-ons.
 * Distributed under the MIT license.
 */

'use strict';
const validateOptions = (function(_validateOptions) {
    return function validateOptions(options, requirements) {
        if (options !== Object(options)) {
            throw new Error('Validation error: options must be a dictionary (object)!');
        }
        return _validateOptions(options, requirements);
    };
})(require('sdk/deprecated/api-utils').validateOptions);

const { data, name } = require('sdk/self');
const selfData = require('self-data');
const { Panel } = require('sdk/panel');
const tabs = require('sdk/tabs');

const { EventTarget } = require('sdk/event/target');
const EventEmitter = require('sdk/event/core');


function RESOURCE(path) {
    if (typeof path == 'string' && path && !~path.indexOf(':'))
       return data.url(path);
    return path;
}
function toColorArray(color) {
    const E_COLOR_ARRAY = 'Invalid color. Must be an array of four integers ' +
                          ' in the range [0,255] that make up a RGBA color, ' +
                          ' or a hex RGB string, e.g. #F00 or #FF0000.';
    let r, g, b, a;
    if (typeof color == 'string') {
        if (!color.match(/^#([a-f0-9]{3}){1,2}$/i))
            throw new Error(E_COLOR_ARRAY);
        if (color.length == 4) { // #RGB
            r = parseInt(color[1] + color[1], 16);
            g = parseInt(color[2] + color[2], 16);
            b = parseInt(color[3] + color[3], 16);
        } else { // #RRGGBB
            r = parseInt(color[1] + color[2], 16);
            g = parseInt(color[3] + color[4], 16);
            b = parseInt(color[5] + color[6], 16);
        }
        a = 1;
    } else if (Array.isArray(color) && color.length == 4) {
        if (!color.every(function(c) c >= 0 && c <= 255 && (0|c) === c))
            throw new Error(E_COLOR_ARRAY);
        [r, g, b, a] = color;
    } else
        throw new Error(E_COLOR_ARRAY);
    return [r, g, b, a];
}
function defProp(obj, key, onSet) {
    let val = obj[key];
    if (typeof onSet != 'function') throw new Error('defProp: arg 3 must be a function');
    Object.defineProperty(obj, key, {
        get: function() val,
        set: function(v) onSet(val = v),
        enumerable: true
    });
}

// An extension may only have one browserAction popup and badge:
const POPUP_MIN_HEIGHT = 32;
const POPUP_MIN_WIDTH = 32;
const EMPTY_POPUP = selfData.url('popup.html');
function createPopup(browserAction, badgeState) {
    defProp(badgeState, 'popupPath', function() {
        popup.contentURL = RESOURCE(badgeState.popupPath) || EMPTY_POPUP;
        if (!badgeState.popupPath && popup.isShowing) {
            popup.hide();
        }
    });

    // Should only be called by createBadge
    var popup = Panel({
        width: POPUP_MIN_WIDTH,
        height: POPUP_MIN_HEIGHT,
        contentURL: RESOURCE(badgeState.popupPath) || EMPTY_POPUP,
        contentScriptFile: selfData.url('popup.js'),
        contentScriptWhen: 'start',
        onMessage: function(message) {
            browserAction.onMessage.dispatch(message);
        },
        onShow: function() {
            if (!badgeState.popupPath || !badgeState.enabled) {
                popup.hide();
            }
        }
    });
    popup.port.on('hide', function() popup.hide());
    popup.port.on('dimensions', function(dimensions) {
        // Auto-resize pop-up.
        if (dimensions.width || dimensions.height) {
            let width = Math.max(POPUP_MIN_WIDTH, dimensions.width);
            let height = Math.max(POPUP_MIN_HEIGHT, dimensions.height);
            popup.resize(width, height);
        }
    });
    return popup;
}

let badgeCounter = 0;
function createBadge(browserAction, badgeState) {
    let popup = createPopup(browserAction, badgeState);
    let showPopup = popup.show;
    // Only show the popup if the path makes sense
    popup.show = function() badgeState.popupPath && showPopup.apply(this, arguments);

    let renderBadgeText = function() tbw.port.emit('setBadgeText', badgeState.badgeText);
    let renderBadgeBackground = function() tbw.port.emit('setBadgeBackgroundColor', badgeState.badgeBackgroundColor);
    let renderBadgeIcon = function() tbw.port.emit('setIcon', RESOURCE(badgeState.iconURL));
    let renderEnableState = function() tbw.port.emit('enabled', badgeState.enabled);
    defProp(badgeState, 'badgeText', renderBadgeText);
    defProp(badgeState, 'badgeBackgroundColor', renderBadgeBackground);
    defProp(badgeState, 'setIcon', renderBadgeIcon);
    defProp(badgeState, 'enabled', renderEnableState);
    defProp(badgeState, 'title', function() tbw.title = badgeState.title);

    var tbw = require('toolbarwidget').ToolbarWidget({
        panel: popup,
        tooltip: badgeState.title,
        toolbarID: 'nav-bar',
        id: 'browserAction' + (badgeCounter++),
        label: name,
        width: 32,
        height: 32,
        contentURL: selfData.url('browserActionBadge.html'),
        contentScriptFile: selfData.url('browserActionBadge.js'),
        contentScriptWhen: 'ready',
        onAttach: function(widgetView) {
            // Turn browserAction into a square shape
            if (tbw.width != tbw.minHeight) {
                tbw.width = tbw.minHeight;
            }
            // browserAction.js sends a single message when it's loaded
            // When that happens, update the badge text.
            widgetView.once('message', function() {
                renderBadgeText();
                renderBadgeBackground();
                renderBadgeIcon();
                renderEnableState();
            });
        },
        onClicked: function() {
            if (badgeState.enabled && !badgeState.popupPath) {
                // Trigger click event iff a popup is not attached
                browserAction.onClicked.dispatch();
            }
        }
    });
    return tbw;
}
function addEvents(browserAction) {
    let eventTarget = EventTarget();
    for (let eventName of ['onClicked', 'onMessage']) {
        browserAction[eventName] = {
            addListener: eventTarget.on.bind(eventTarget, eventName),
            removeListener: eventTarget.removeListener.bind(eventTarget, eventName),
            dispatch: EventEmitter.emit.bind(null, eventTarget, eventName)
        };
    }
}
function validateBrowserActionOptions(options) {
    return validateOptions(options, {
        default_icon: {
            map: function(icon) {
                if (icon && typeof icon == 'object') icon = icon[19] || icon[38];
                if (typeof icon == 'string') icon = icon; // TODO: Convert to URL
                else icon = 'TODO_DEFAULT_ICON';
                return icon;
            },
            is: ['undefined', 'string']
        },
        default_popup: {
            // TODO: Convert path to URL
            map: function(path) typeof path == 'string' ? path : path,
            is: ['undefined', 'string']
        },
        default_title: {
            map: function(title) title === undefined ? '' : title,
            is: ['undefined', 'string']
        }
    });
}


function Badge(badgeOptions) { // Exported
    badgeOptions = validateBrowserActionOptions(badgeOptions);
    
    let badgeState = {
        badgeText: badgeOptions.default_title || '',
        badgeBackgroundColor: [0, 0, 0, 0], // RGBA ColorArray
        iconURL: badgeOptions.default_icon || '',
        enabled: true,
        title: '',
        popupPath: badgeOptions.default_popup || ''
    };
    badgeOptions = undefined; // Make intentions explicit: We don't use badgeOptions any more.

    // This object is going to be returned
    let browserAction = {};
    // Attach onMessage and onClicked events
    addEvents(browserAction);
    // Initialize and show badge
    let tbw = createBadge(browserAction, badgeState);

    // Add public API
    browserAction.setTitle = function(details) {
        details = validateOptions(details, {
            title: {
                is: ['string']
            }
        });
        badgeState.title = details.title;
    };
    browserAction.getTitle = function() badgeState.title;

    browserAction.setIcon = function(details) {
        details = validateOptions(details, {
            imageData: {
                map: function(imageData) {
                    return 'width' in imageData ? imageData : imageData['19'] || imageData['38'];
                },
                is: ['undefined'], // This data comes from <canvas>. Who is using <canvas> in a Jetpack add-on?
                message: 'imageData not supported yet! Use {path: canvas.toDataURL()} instead!'
            },
            path: {
                map: function(path) {
                    path = typeof path == 'string' ? path : path['19'] || path['38'];
                    return path;
                },
                is: ['string']
            }   
        });
        badgeState.iconURL = details.path;
    };

    browserAction.setPopup = function(details) {
        details = validateOptions(details, {
            popup: {
                map: function(path) {
                    return RESOURCE(path);
                },
                is: ['null', 'undefined', 'string']
            }
        });
        badgeState.popupPath = details.popup;
    };
    browserAction.getPopup = function() badgeState.popupPath;

    browserAction.setBadgeText = function(details) {
        details = validateOptions(details, {
            text: {
                is: ['string']
            }   
        });
        badgeState.badgeText = details.text;
    };
    browserAction.getBadgeText = function() badgeState.badgeText;

    browserAction.setBadgeBackgroundColor = function(details) {
        badgeState.badgeBackgroundColor = toColorArray(details.color);
    };
    browserAction.getBadgeBackgroundColor = function() toColorArray(badgeState.badgeBackgroundColor);

    browserAction.enable = function() { badgeState.enabled = true; };
    browserAction.disable = function() { badgeState.enabled = false; };

    return browserAction;
}
exports.BrowserAction = Badge;
