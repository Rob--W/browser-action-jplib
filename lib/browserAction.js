/**
 * (c) 2013 Rob Wu <gwnRob@gmail.com>
 * Implementation of chrome.browserAction for Jetpack Add-ons.
 * Distributed under the MIT license.
 */

// This module is modeled after the chrome.browserAction API of Chrome 26
// Everything is implemented, except for:
// - All `details` parameter types ignore the `tabId` property.
// - The `setIcon` method does not support details.imageData
// New methods:
// - Use `destroy` to remove the browser action.
// - Use `sendMessage` to send a message to the popup (API like chrome.runtime.sendMessage)
// - Use the `onMessage` event to receive a message from the popup (like chrome.runtime.onMessage)

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
const selfData = require('browser-action-jplib-data');
const { Panel } = require('sdk/panel');

const { createMessageChannel, messageContentScriptFile } = require('messaging');
const { EventTarget } = require('sdk/event/target');
const EventEmitter = require('sdk/event/core');

const tabs = require('sdk/tabs');
const chromeTabs = require('chrome-tabs-api');


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
        a = 255;
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
function getTypeOf(object) {
    let type = typeof object;
    if (typeof type != 'object') return type;
    return object === null ? 'null' : Array.isArray(object) ? 'array' : 'object';
}

const POPUP_MIN_HEIGHT = 32;
const POPUP_MIN_WIDTH = 32;

// Create a panel without any content
function createPopup(contentScriptOptions) {
    // Should only be called by createBadge
    var popup = Panel({
        width: POPUP_MIN_WIDTH,
        height: POPUP_MIN_HEIGHT,
        contentScriptFile: [messageContentScriptFile],
        contentScript: selfData.load('popup.js'), // Always run after contentScriptFile
        contentScriptWhen: 'start',
        contentScriptOptions: contentScriptOptions
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

function initializePopup(browserAction, badgeState) {
    let popup = null;
    let contentScriptOptions = {
        channelName: 'browserAction'
    };
    // Create and expose message passing API
    let channel = createMessageChannel(contentScriptOptions);
    browserAction.onMessage = channel.onMessage;
    browserAction.sendMessage = channel.sendMessage;

    defProp(badgeState, 'popupPath', function(popupPath) {
        if (!popup || !popup.isShowing) {
            setPanelPlaceholder();
        } else {
            // Do not replace panel while it's visible (consistent with Chromium)
            // Remove previous event if set (occurs if setPopup is called 2+ times
            //  while the popup is visible)
            popup.off('hide', setPanelPlaceholder);
            popup.once('hide', setPanelPlaceholder);
        }
    });
    setPanelPlaceholder();

    let widgetViews = [];
    var returnValue = {
        destroy: destroy,
        registerWidgetView: registerWidgetView
    };
    return returnValue;

    function destroy() {
        if (!channel) return; // Already destroyed
        channel.port = channel = null; // "channel = null" implies being destroyed

        if (popup) {
            popup.destroy();
            popup = null;
        }
    }
    function setPanelPlaceholder() {
        if (!channel) return; // No channel implies being destroyed

        if (popup) {
            popup.destroy();
            popup = null;
            channel.port = null;
        }
        if (badgeState.popupPath && badgeState.enabled) {
            popup = createPopup(contentScriptOptions);
            popup.once('show', function() {
                popup.contentURL = badgeState.popupPath;
            });
            popup.once('hide', function() {
                setPanelPlaceholder();
            });
            channel.port = popup.port;
        }
        for each (var widgetView in widgetViews) {
            widgetView.panel = popup;
        }
    }

    function registerWidgetView(widgetView) {
        widgetViews.push(widgetView);
        widgetView.panel = popup;
        widgetView.once('detach', function() {
            var index = widgetViews.indexOf(widgetView);
            if (index !== -1) widgetViews.splice(index, 1);
        });
    }
}

let badgeCounter = 0;
function createBadge(browserAction, badgeState) {
    let renderBadgeText = function() tbw.port.emit('setBadgeText', badgeState.badgeText);
    let renderBadgeBackground = function() tbw.port.emit('setBadgeBackgroundColor', badgeState.badgeBackgroundColor);
    let renderBadgeIcon = function() tbw.port.emit('setIcon', badgeState.iconURL || selfData.url('default_icon.png'));
    let renderEnableState = function() tbw.port.emit('enabled', badgeState.enabled);
    defProp(badgeState, 'badgeText', renderBadgeText);
    defProp(badgeState, 'badgeBackgroundColor', renderBadgeBackground);
    defProp(badgeState, 'iconURL', renderBadgeIcon);
    defProp(badgeState, 'enabled', renderEnableState);
    defProp(badgeState, 'title', function() tbw.tooltip = badgeState.title);

    let content = selfData.load('browserActionBadge.html');
    if (badgeState.iconURL) {
        content = content.replace('default_icon.png', badgeState.iconURL.replace(/"/g, '&quot;'));
    }
    var popupRenderer = initializePopup(browserAction, badgeState);
    var tbw = require('toolbarwidget').ToolbarWidget({
        tooltip: badgeState.title,
        toolbarID: 'nav-bar',
        id: 'browserAction' + (badgeCounter++),
        label: name,
        width: 32,
        height: 32,
        autoShrink: true,
        aspectRatio: 1,
        content: content,
        contentScript: selfData.load('browserActionBadge.js'),
        contentScriptWhen: 'ready',
        onAttach: function(widgetView) {
            popupRenderer.registerWidgetView(widgetView);
            // browserAction.js sends a single message when it's loaded
            // When that happens, update the badge text.
            widgetView.once('message', function() {
                renderBadgeText();
                renderBadgeBackground();
                renderBadgeIcon();
                renderEnableState();
            });
        },
        onClick: function() {
            if (badgeState.enabled && !badgeState.popupPath) {
                // Trigger click event iff a popup is not attached
                let chromeTab = chromeTabs.toChromeTab(tabs.activeTab);
                browserAction.onClicked.dispatch(chromeTab);
            }
        }
    });
    let tbw_destroy = tbw.destroy;
    tbw.destroy = function() {
        popupRenderer.destroy();
        popupRenderer = null;
        tbw_destroy();
    };
    return tbw;
}
// Implement public browserAction events
// Return list of event names
function addEvents(browserAction) {
    let eventTarget = EventTarget();
    let eventNames = ['onClicked'];
    let offEventFactory = function(eventName) EventEmitter.off.bind(null, eventTarget, eventName);
    for (let eventName of eventNames) {
        browserAction[eventName] = {
            addListener: eventTarget.on.bind(eventTarget, eventName),
            removeListener: eventTarget.removeListener.bind(eventTarget, eventName),
            dispatch: EventEmitter.emit.bind(null, eventTarget, eventName),
            destroy_: offEventFactory(eventName)
        };
    }
    return eventNames;
}
const validators = {
    iconPath: {
        map: function(icon) {
            if (icon && typeof icon == 'object') icon = '19' in icon ? icon[19] : icon[38];
            return RESOURCE(icon);
        },
        is: ['string']
    },
    popupPath: {
        map: function(path) RESOURCE(typeof path == 'string' ? path : path),
        is: ['string']
    },
    title: {
        is: ['string']
    },
    badgeText: {
        is: ['string']
    }
};
function validateBrowserActionOptions(options) {
    let optional = function(spec) {
        return Object.create(spec, {
            map: {
                value: function(v) v === undefined ? '' : spec.map(v)
            }
        });
    };
    return validateOptions(options, {
        default_icon : optional( validators.iconPath ),
        default_popup: optional( validators.popupPath),
        default_title: optional( validators.title    )
    });
}
function createCallbackGetter(getter) function(details, callback) {
    // Callbacks are actually superfluous, because all data is also synchronously available.
    // However, just to be consistent with the Chrome API...
    if (typeof details != 'object' || typeof callback != 'function') {
        throw new Error("Invocation of form browserAction.getTitle(" + getTypeOf(details) +
                       ", " + getTypeOf(callback) +  ") doesn't match definition" +
                       "browserAction.getTitle(object details, function callback)");
    }
    callback(getter());
}


function Badge(badgeOptions) { // Exported
    badgeOptions = validateBrowserActionOptions(badgeOptions);
    
    // Note: iconURL and popupPath must be a valid URL (e.g. RESOURCE) or an empty string.
    let badgeState = {
        title: badgeOptions.default_title,
        badgeText: '',
        badgeBackgroundColor: [0, 0, 0, 0], // RGBA ColorArray
        iconURL: badgeOptions.default_icon,
        enabled: true,
        popupPath: badgeOptions.default_popup
    };
    badgeOptions = undefined; // Make intentions explicit: We don't use badgeOptions any more.

    // This object is going to be returned
    let browserAction = {};
    // Attach onMessage and onClicked events
    let eventNames = addEvents(browserAction);
    // Initialize and show badge
    let tbw = createBadge(browserAction, badgeState);

    // Add public API
    browserAction.setTitle = function(details) {
        details = validateOptions(details, {
             title: validators.title
        });
        badgeState.title = details.title;
    };
    browserAction.getTitle = createCallbackGetter(function() badgeState.title);

    browserAction.setIcon = function(details) {
        details = validateOptions(details, {
            imageData: {
                map: function(imageData) {
                    return 'width' in imageData ? imageData : imageData['19'] || imageData['38'];
                },
                is: ['undefined'], // This data comes from <canvas>. Who is using <canvas> in a Jetpack add-on?
                message: 'imageData not supported yet! Use {path: canvas.toDataURL()} instead!'
            },
            path: validators.iconPath
        });
        badgeState.iconURL = details.path;
    };

    browserAction.setPopup = function(details) {
        details = validateOptions(details, {
            popup: validators.popupPath
        });
        badgeState.popupPath = details.popup;
    };
    browserAction.getPopup = createCallbackGetter(function() badgeState.popupPath);

    browserAction.setBadgeText = function(details) {
        details = validateOptions(details, {
            text: validators.badgeText
        });
        badgeState.badgeText = details.text;
    };
    browserAction.getBadgeText = createCallbackGetter(function() badgeState.badgeText);

    browserAction.setBadgeBackgroundColor = function(details) {
        badgeState.badgeBackgroundColor = toColorArray(details.color);
    };
    browserAction.getBadgeBackgroundColor = createCallbackGetter(function() toColorArray(badgeState.badgeBackgroundColor));

    browserAction.enable = function() { badgeState.enabled = true; };
    browserAction.disable = function() { badgeState.enabled = false; };

    browserAction.destroy = function() {
        if (!tbw) return;
        tbw.destroy();
        tbw = null;
        browserAction.onMessage.destroy_();
        for (let eventName of eventNames) {
            browserAction[eventName].destroy_();
            browserAction[eventName] = null;
        }
        badgeState = null;
    };

    return browserAction;
}
exports.BrowserAction = Badge;
