// exports XMLSerializer().serializeToString for debugging.
'use strict';
const {Cc,Ci} = require("chrome");
const serializer = Cc["@mozilla.org/xmlextras/xmlserializer;1"].createInstance(Ci.nsIDOMSerializer);

module.exports = function(root) {
    return serializer.serializeToString(root);
};
