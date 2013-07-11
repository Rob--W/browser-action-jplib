The `messaging` module provides an API to communicate between a page and the background page.

Jetpack inserts content script using the [page-mod](modules/sdk/page-mod.html) module. This module
provides an object, `port`, for sending messages in one direction. The `messaging` module
allows bidirectional messages, modelled after the [message passing APIs](https://developer.chrome.com/extensions/messaging.html) from Chromium.


## Example

On the background page, use [page-mod](modules/sdk/page-mod.html) to attach the script.

    const { createMessageChannel, messageContentScriptFile } = require('messaging');
    const { PageMod } = require('sdk/page-mod');
    const { data } = require('sdk/self');

    // Adds the message API to every page within the add-on
    var pagemod = PageMod({
        include: data.url('*'),
        contentScriptWhen: 'start',
        // Always put the messaging module at the start of the contentScriptFile array!
        contentScriptFile: [messageContentScriptFile],
        contentScriptOptions: {
            channelName: 'whatever you want',
            // Set the following to false if you want to communicate between
            // the "extension" and a content script instead of the page.
            endAtPage: true
        },
        onAttach: function(worker) {
            var extension = createMessageChannel(pagemod.contentScriptOptions, worker.port);
            extension.onMessage.addListener(function(message, sender, sendResponse) {
                if (message.greeting == 'hello')
                    sendResponse({farewell: 'goodbye'});
            });
        }
    });

Make sure that all `contentScript` options are defined as shown above. You can pick any unique
`channelName` if you want to, as long as it is a string. Finally, to establish a communication
channel between the content script and the main page, call `createMessageChannel` as shown above.

After doing this, you'll be able to easily communicate with your background page through a new
global `extension` object. If the `endAtPage` parameter is set to `false`, then the following
code (minus `<script>`-tags) can be run in the content script, but not in the page.

    <script>
    extension.sendMessage({
        greeting: 'hello'
    }, function(result) {
        document.body.textContent = result.farewell;
    });
    </script>

<api name="createMessageChannel">
@function
  @param options {Object}
    @prop channelName {String}
      Unique name for the channel. Used to by the main and content script to connect the channels.
    @prop endAtPage {Boolean}
      *optional*, defaults to `true`.
      Whether the channel ends at the page. If false, the channel will end at the content script.
      At the end of the channel, the global `extension` variable is declared.
  @param port {Port}
    An event emitter shared by the main script and the content script.
    Used to transport messages.
</api>
<api name="messageContentScriptFile">
@property {String}
  The location of the content script.
  This content script sets up the communication between the page and content script,
  and creates a channel to the main script.
</api>

<api name="extension">
  @class
  A global object, `window.extension` is defined on the **page** when a channel has been set up.
  If the content script is inserted using `contentScriptWhen: "start"`, you can be assured that
  the object is defined.
  If the `endAtPage` parameter is set to `false`, then it is **not** defined on the page, but
  in the **content script**.

<api name="sendMessage">
@method
@param message {any}
@param responseCallback {function}
*Optional*. Called when the message has been delivered. If the receiver called `sendResponse` with
an argument, this function will receive that single argument as a parameter.
</api>

<api name="onMessage.addListener">
@method
@param listener {function}
Bind a message listener. When `sendMessage` has been called at the other end of the channel,
the `onMessage` event will be dispatched with three arguments:

 * `message`
   The message sent by the calling script.
 * `sender` (*reserved, currently `null`*)
 * `sendResponse`  
   Function to call (at most once) when you have a response. The argument
   should be any JSON-ifiable object. If you have more than one `onMessage`
   listener in the same document, then only one may send a response. This
   function becomes invalid when the event listener returns, unless you return
   `true` from the event listener to indicate you wish to send a response
   asynchronously (this will keep the message channel open to the other end
   until `sendResponse` is called).
   
</api>
<api name="onMessage.removeListener">
@method
@param listener
Unbind a message listener.
</api>

</api>
