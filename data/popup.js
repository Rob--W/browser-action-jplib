/**
 * (c) 2013 Rob Wu <gwnRob@gmail.com>
 * Implementation of chrome.browserAction for Jetpack Add-ons.
 * Distributed under the MIT license.
 */

/*jshint browser:true*/
/*globals self*/
'use strict';
function updatePanelDimensions() {
    let wrapper = document.documentElement;
    let dimensions = {
        height: wrapper.offsetHeight || wrapper.offsetHeight,
        width: wrapper.offsetWidth || wrapper.scrollWidth
    };
    self.port.emit('dimensions', dimensions);
}
if (document.readyState == 'complete') {
    updatePanelDimensions();
} else {
    document.addEventListener('DOMContentLoaded', updatePanelDimensions);
    window.addEventListener('load', function() {
        setTimeout(function() {
            updatePanelDimensions();
        }, 0);
    });
}

// location.origin supported in Firefox 21+
if (!('origin' in location)) location.origin = location.protocol + '//' + location.host;

const CLOSE_TOKEN = Math.random();

document.defaultView.addEventListener('message', function(event) {
    if (event.origin && event.origin === location.origin) {
        if (event.data === CLOSE_TOKEN) {
            self.port.emit('hide');
        } else {
            self.postMessage(event.data);
        }
    } else {
        console.error('Unknown message origin: ' + event.origin);
    }
});

// When window.close() is called, hide the popup.
document.documentElement.setAttribute('onreset',
        'document.documentElement.removeAttribute("onreset");' +
        'window.close=function(){postMessage(' + CLOSE_TOKEN + ',"*")};'
);
document.documentElement.onreset();
