/**
 * (c) 2013 Rob Wu <gwnRob@gmail.com>
 * Implementation of chrome.browserAction for Jetpack Add-ons.
 * Distributed under the MIT license.
 */

/*jshint browser:true*/
/*globals self*/
'use strict';
var badgeText = document.getElementById('badgeText');
self.port.on('setBadgeText', function(text) {
    badgeText.textContent = text;
    badgeText.hidden = !text;
});
self.port.on('setBadgeBackgroundColor', function(colorArray) {
    colorArray[3] = colorArray[3] / 255; // Alpha channel convert [0,255] to [0,1]
    let color = 'rgba(' + colorArray.join(',') + ')';
    badgeText.style.backgroundColor = color;

});
self.port.on('setIcon', function(url) {
    document.getElementById('button-img').src = url;
});

self.port.on('enabled', function(enabled) {
    document.documentElement.classList[enabled?'remove':'add']('disabled');
    document.querySelector('button').disabled = !enabled;
});

self.postMessage(''); // I am alive, request render data
