/**
 * (c) 2013 Rob Wu <gwnRob@gmail.com>
 * Conversion between Chrome tabs.Tab type and Firefox's addon SDK's Tab type
 * Distributed under the MIT license.
 */

'use strict';
const tabs = require('sdk/tabs');
const { isPrivate } = require('sdk/private-browsing');

// Convert SDK's tab type to Chrome's
function sdkTabToChrome(sdkTab) {
    return {
        id: sdkTab.id,
        index: sdkTab.index,
//        windowId: 
//        openerTabId: 
        highlighted: false,
        active: sdkTab.window.tabs.activeTab === sdkTab,
        pinned: sdkTab.isPinned,
        url: sdkTab.url,
        title: sdkTab.title,
//        faviconUrl: sdkTab.favicon,
//        status: 
        incognito: isPrivate(sdkTab)
    };
}

// Get the SDK's tab for a given Chrome tab.
function chromeTabToSdk(chromeTab) {
    var chromeTabId = chromeTab.id;
    for each (var sdkTab in tabs) {
        if (sdkTab.id === chromeTabId) {
            return sdkTab;
        }
    }
    return null;
}

exports.toChromeTab = sdkTabToChrome;
exports.toFirefoxTab = chromeTabToSdk;
