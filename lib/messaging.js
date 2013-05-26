/**
 * (c) 2013 Rob Wu <gwnRob@gmail.com>
 * Implementation of event routing: page -> content script -> main and back.
 * Distributed under the MIT license.
 */

/*jshint browser:true*/
/*globals self*/
'use strict';

if (typeof exports == 'object') { // Main
    exports.createMessageChannel = createMessageChannel;
    // This hard-coded lib path sucks, but there's no other option other than
    // Duplicating the file, or hardcoding a path.
    let selfData = require('self-data');
    exports.messageContentScriptFile = selfData.url('messaging.js').replace('data/messaging.js', 'lib/messaging.js');
} else if (self.port) {
    let options = self.options || {};
    createMessageChannel(options.channelName, self.port, !!options.includeDataURI);
} else {
    throw new Error('Fatal error in messaging module: Context unknown!');
}

// required String channelName : Used as an unique identifier for the event propagation
// required* Port port (self.port, pagemod port, ..) :   (not needed for context = page)
// optional Boolean includeDataURI  : If true, the message API is added to data-URI pages
function createMessageChannel(channelName, port, includeDataURI) {
    if (typeof channelName != 'string') throw new Error('createMessageChannel: channelName must be a string!');
    channelName = channelName.replace(/^(message-router-)?/, 'message-router-'); // Ensure prefix

    const THIS_CHANNEL_ID = Math.random();
    
    const throw_async = function(e) { throw e; };
    const NOOP = function() {};
    const INVALIDATE_SENDRESPONSE = {}; // Some constant

    const CONTEXT = typeof exports == 'object' ? 'main' :
                    typeof self == 'object' && typeof self.port == 'object' ? 'content script' :
                    typeof document == 'object' ? 'page' : 'unknown';
    if (CONTEXT == 'unknown') throw new Error('Fatal error in messaging module: Context unknown!!');

    var _callbacks = [];
    var stack = [];

    /* No closures within this function. */
    function dispatchEvent(data, sendResponseID) {
        /* only allow JSON-serializable data */
        data = JSON.stringify(data);
        var callbacks = _callbacks.slice(0);
        stack.push({data: data, callbacks: callbacks, sendResponseID: sendResponseID});

        if (stack.length === 1) {
            /* Stack was empty, so initiate dispatch.
             * If stack was not empty, the loop condition will ensure that the event is dispatched correctly */
            while (stack.length > 0) {
                data = stack.shift();
                callbacks = data.callbacks;
                var keepAlive = false;
                data = data.data;
                var sendResponse = sendResponse.bind(null, data.sendResponseID);
                for (var callback of callbacks) {
                    try {
                        var res = true === callback(/*message*/JSON.parse(data), /*sender*/null, sendResponse);
                        keepAlive = keepAlive || res;
                    } catch (e) {
                        throw_async(e);
                    }
                }
                if (!keepAlive) {
                    /* Not returned true, invalidate the callback. */
                    sendResponse(INVALIDATE_SENDRESPONSE);
                }
            }
        }
    }

    var packagePaths = {};
    function sendResponse(sendResponseID, response) {
        if (!sendResponseID) return;
        var path = packagePaths[sendResponseID];
        if (!path) return;
        var direction = CONTEXT != 'main' ? 'down' : 'up';
        var packet = { 
            path: path, 
            direction: direction,
            isResponse: true,
            messageID: sendResponseID,
            message: response
        };  
        deliverPacket(packet);
    }

    const onMessage = {
        addListener: function(func) {
            if (typeof func != 'function') throw new Error('onMessage.addListener expected a function!');
            _callbacks.push(func);
        },
        removeListener: function(callback) {
            var i = _callbacks.indexOf(callback);
            if (~i) _callbacks.splice(i, 1);
        },
        dispatch: dispatchEvent,
        destroy_: function() _callbacks.length = 0
    };
    const extension = {
        sendMessage: sendMessage,
        onMessage: onMessage
    };

    var response_callbacks = [];
    function sendMessage(message, callback) {
        if (callback && typeof callback != 'function')
            throw new Error('Usage: extension.sendMessage(any message, function callback)');

        var messageID;
        message = JSON.stringify(message);
        if (callback) {
            messageID = Math.random();
            response_callbacks[messageID] = callback;
        }

        /* If a message is initialized from main, go down. Otherwise, let the message bubble upwards */
        var direction = CONTEXT == 'main' ? 'down' : 'up';
        var packet = {
            path: [],
            direction: direction,
            isResponse: false,
            messageID: messageID,
            message: message
        };
        deliverPacket(packet);
    }

    function deliverPacket(packet) {
        /*globals CustomEvent*/
        if (packet.isResponse) {
            if (packet.path[packet.path.length - 1] != THIS_CHANNEL_ID) {
                console.log('Unexpected path, dropped packet.'); // TODO: Remove this
                return;
            }
            packet.path.pop();
        } else {
            packet.path.push(THIS_CHANNEL_ID);
        }

        if (CONTEXT == 'content script' && packet.direction == 'down' ||
            CONTEXT == 'page' && packet.direction == 'up') {
            var evt = new CustomEvent(channelName, false, false, {
                detail: packet
            });
            document.documentElement.dispatchEvent(evt);
        } else {
            port.emit(channelName);
        }
    }
    function receivePacket(packet) {
        if (CONTEXT == 'page' || CONTEXT == 'main') {
            var message = JSON.parse(packet.message);
            if (packet.isResponse) {
                var callback = response_callbacks[packet.messageID];
                if (callback) {
                    delete response_callbacks[packet.messageID];
                    callback(message);
                }
            } else {
                if (packet.messageID) {
                    packagePaths[packet.messageID] = packet.path;
                }
                onMessage.dispatch(message, packet.messageID);
            }
        } else { // CONTEXT == 'content script'
            deliverPacket(packet);
        }
    }

    if (CONTEXT == 'page' || CONTEXT == 'content script') {
        // Only react to the relevant message:
        // If page, only react to messages which go down
        // If content script, only pick up messages which go up.
        var expectedDirection = CONTEXT == 'page' ? 'down' : 'up';
        document.addEventListener(channelName, function(e) {
            if (e.detail.direction == expectedDirection) {
                receivePacket(e.detail);
            }
        });
    }

    if (CONTEXT == 'content script') {
        if (location.protocol == 'resource:' || includeDataURI && location.protocol == 'data:') {
            // Note: Only allow data-URI if the content is trustworthy.
            // A http page could craft a data URI, then redirect to it.
            // Set up API for page
            document.documentElement.setAttribute('onreset', 
                    'document.documentElement.removeAttribute("onreset");' +
                    '(' + createMessageChannel + ')(' + JSON.stringify(channelName) + ');'
            );
            document.documentElement.onreset();
        }
    }
    if (CONTEXT == 'page') {
        window.extension = extension; // Export to global scope
    }
    
    return extension;
}
