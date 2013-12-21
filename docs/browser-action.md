The `browserAction` module is modelled after the [`chrome.browserAction`](https://developer.chrome.com/extensions/browserAction.html) API.

There are only a few differences between this Jetpack module and the `chrome.browserAction` API:

1. Tab-specific behavior cannot be defined, because the chrome.tabs API is not emulated in Firefox.
   Consequently, all `tabId` parameters are ignored.
2. The `setIcon` method does not support the `imageData` parameter.
3. A new method, `destroy` has been added to remove the badge.
4. `browserAction.sendMessage` and `browserAction.onMessage` are added. These are similar to
   the  `chrome.runtime.sendMessage` and `chrome.runtime.onMessage` Chrome APIs, used to communicate
   between the popup and the main page.

## Example

    var badge = require('browserAction').BrowserAction({
        default_icon: 'images/icon19.png', // optional
        default_title: 'Badge title',      // optional; shown in tooltip
        default_popup: 'popup.html'        // optional
    });

## Example: Change badge text on click.

    var badge = require('browserAction').BrowserAction({
        default_icon: 'images/icon19.png', // optional
        default_title: 'Badge title'       // optional; shown in tooltip
    });
    // Set badge text to x on click
    badge.onClicked.addListener(function(tab) {
        badge.setBadgeText({
            text: 'x'
        });
    });

<api name="BrowserAction">
@class

Represents a browser action badge.

<api name="BrowserAction">
@constructor
Creates a new badge. The badge is immediately added to the toolbar.

@param options {object}
  Badge configuration options, compatible with the syntax from Chrome's
  [`browser_action` entry](https://developer.chrome.com/extensions/browserAction.html#manifest) in the manifest file.

  @prop default_icon {string}
    *Optional*.
    The URI of an icon. This path is relative to your add-on's `data` directory.
    This can be changed later using the `setIcon` method.

  @prop default_title {string}
    *Optional*.
    The default tooltip text of your browser action button. This can be changed
    later using the `setTitle` method.

  @prop default_popup {string}
    *Optional*.
    The location of your popup. If set, a popup shows up when the badge is clicked.
    This value can be changed later using the `setPopup` method.

</api>

<api name="setTitle">
@method
  Sets the title of the browser action. This shows up in the tooltip.

  @param details {object}
    @prop title {string}
      The string the browser action should display when moused over.
</api>

<api name="getTitle">
@method
  Gets the title of the browser action.

  @param details {object}
    Reserved. Use `{}`.

  @param callback {function}
    The `callback` parameter should specify a function that expects a
    string as its first parameter. This string is the current tooltip
    text of the browser action.

</api>

<api name="setIcon">
@method
  Sets the icon for the browser action.

  @param details {object}
    @prop path {string}
      The location of the icon, relative to the data directory.

  @param callback {function}
    The `callback` parameter should specify a function that expects no parameters.
    
</api>

<api name="setPopup">
@method
  Sets the html document to be opened as a popup when the user clicks on the browser action's icon.

  @param details {object}
    @prop popup {string}
      The html file to show in a popup. If set to the empty string (''), no popup is shown.
      This path is relative to the add-on's `data` directory.

</api>

<api name="getPopup">
@method
  Gets the html document set as the popup for this browser action.

  @param details {object}
    reserved. Use `{}`.

  @param callback {function}
    The `callback` parameter should specify a function that expects a
    string as its first argument. This string is the absolute URL
    of the popup document's location.

</api>

<api name="setBadgeText">
@method
  Sets the badge text for the browser action. The badge is displayed on top of the icon.

  @param details {object}
    @prop text {string}
      Any number of characters can be passed, but only about four can fit in the space.

</api>

<api name="getBadgeText">
@method
  Gets the badge text of the browser action.

  @param details {object}
    Reserved. Use `{}`.

  @param callback {function}
    The `callback` parameter should specify a function that expects a
    string as its first parameter. This string is the current badge text.

</api>

<api name="setBadgeBackgroundColor">
@method
  Sets the background color for the badge.

  @param details {object}
    @prop color {string,ColorArray}
      An array of four integers in the range `[0,255]` that make up the RGBA color
      of the badge. For example, opaque red is `[255, 0, 0, 255]`. Can also be a
      string with a CSS hex value, with opaque red being `#FF0000` or `#F00`.

</api>

<api name="getBadgeBackgroundColor">
@method
  Gets the background color of the browser action.

  @param details {object}
    Reserved. Use `{}`.

  @param callback {function}
    The `callback` parameter should specify a function that expects a
    ColorArray. This is an ordinary array of four integers in the `[0, 255]`
    range that make up the RGBA color of the badge.

</api>

<api name="enable">
@method
  Enables the browser action. By default, browser actions are enabled.

</api>

<api name="disable">
@method
  Disables the browser action.

</api>

<api name="destroy">
@method
  Jetpack-specific addition: Remove badge from toolbar and destroy associated views and events.
</api>

<api name="sendMessage">
@method
  Jetpack-specific addition; Send a message to the popup.  
  This method follows the API format of Chrome's
  [`chrome.runtime.sendMessage`](https://developer.chrome.com/extensions/runtime.html#method-sendMessage).

  @param message {any}
  @param responseCallback {function}
  *Optional*. Called when the message has been delivered. If the receiver called `sendResponse` with
  an argument, this function will receive that single argument as a parameter.
</api>

<api name="onMessage">
@event
  Jetpack-specific addition; Receive a message from the popup.
  This method follows the API format of Chrome's
  [`chrome.runtime.onMessage`](https://developer.chrome.com/extensions/runtime.html#event-onMessage).

  Implemented using the [messaging](messaging.html) module.
</api>

<api name="onClicked">
@event
  Fired when a browser action icon is clicked. This event will not fire if the browser action has a popup.
@argument {tabs.Tab}
  Object with details about the tab associated with the click. The object follows Chrome's [`tabs.Tab`](https://developer.chrome.com/extensions/tabs.html#type-Tab) format.
  Only the "id", "index", "highlighted", "active", "pinned", "url", "title" and "incognito" properties have been implemented.
  If you wish to get the "faviconUrl" for a given tab, use the [`sdk/places/favicon`](https://addons.mozilla.org/en-US/developers/docs/sdk/latest/modules/sdk/places/favicon.html) SDK module.
</api>

</api>
