// const reactMessage = (m) => {
//   window.ReactNativeWebView.postMessage(
//     JSON.stringify({ type: "epubjs", message: m })
//   );
// };

/**
 * Parse xml (or html) markup
 * @param {string} markup
 * @param {string} mime
 * @param {boolean} forceXMLDom force using xmlDom to parse instead of native parser
 * @returns {document} document
 * @memberof Core
 */
export function parse(markup, mime, forceXMLDom) {
    var doc
    var Parser

    if (typeof DOMParser === 'undefined' || forceXMLDom) {
        Parser = XMLDOMParser
    } else {
        Parser = DOMParser
    }

    // Remove byte order mark before parsing
    // https://www.w3.org/International/questions/qa-byte-order-mark
    if (markup.charCodeAt(0) === 0xfeff) {
        markup = markup.slice(1)
    }

    doc = new Parser().parseFromString(markup, mime)

    return doc
}

/**
 * Generates a UUID
 * based on: http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
 * @returns {string} uuid
 * @memberof Core
 */
export function uuid() {
    var d = new Date().getTime()
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
        /[xy]/g,
        function (c) {
            var r = (d + Math.random() * 16) % 16 | 0
            d = Math.floor(d / 16)
            return (c == 'x' ? r : (r & 0x7) | 0x8).toString(16)
        },
    )
    return uuid
}
/**
 * Check if extension is xml
 * @param {string} ext
 * @returns {boolean}
 * @memberof Core
 */
export function isXml(ext) {
    return ['xml', 'opf', 'ncx'].indexOf(ext) > -1
}

/**
 * Creates a new pending promise and provides methods to resolve or reject it.
 * From: https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/Promise.jsm/Deferred#backwards_forwards_compatible
 * @memberof Core
 */
export function defer() {
    /* A method to resolve the associated Promise with the value passed.
   * If the promise is already settled it does nothing.
   *
   * @param {anything} value : This value is used to resolve the promise
   * If the value is a Promise then the associated promise assumes the state
   * of Promise passed as value.
   */
    this.resolve = null

    /* A method to reject the associated Promise with the value passed.
   * If the promise is already settled it does nothing.
   *
   * @param {anything} reason: The reason for the rejection of the Promise.
   * Generally its an Error object. If however a Promise is passed, then the Promise
   * itself will be the reason for rejection no matter the state of the Promise.
   */
    this.reject = null

    this.id = uuid()

    /* A newly created Pomise object.
   * Initially in pending state.
   */
    this.promise = new Promise((resolve, reject) => {
        this.resolve = resolve
        this.reject = reject
    })
    Object.freeze(this)
}

// import path from "path-webpack";
/**
 * Creates a Path object for parsing and manipulation of a path strings
 *
 * Uses a polyfill for Nodejs path: https://nodejs.org/api/path.html
 * @param	{string} pathString	a url string (relative or absolute)
 * @class
 */
export class Path {
    constructor(pathString) {
        var protocol
        var parsed

        protocol = pathString.indexOf('://')
        if (protocol > -1) {
            pathString = new URL(pathString).pathname
        }

        parsed = this.parse(pathString)

        this.path = pathString

        if (this.isDirectory(pathString)) {
            this.directory = pathString
        } else {
            this.directory = parsed.dir + '/'
        }

        this.filename = parsed.base
        this.extension = parsed.ext.slice(1)
    }

    /**
   * Parse the path: https://nodejs.org/api/path.html#path_path_parse_path
   * @param	{string} what
   * @returns {object}
   */
    parse(what) {
        return path.parse(what)
    }

    /**
   * @param	{string} what
   * @returns {boolean}
   */
    isAbsolute(what) {
        return path.isAbsolute(what || this.path)
    }

    /**
   * Check if path ends with a directory
   * @param	{string} what
   * @returns {boolean}
   */
    isDirectory(what) {
        return what.charAt(what.length - 1) === '/'
    }

    /**
   * Resolve a path against the directory of the Path
   *
   * https://nodejs.org/api/path.html#path_path_resolve_paths
   * @param	{string} what
   * @returns {string} resolved
   */
    resolve(what) {
        return path.resolve(this.directory, what)
    }

    /**
   * Resolve a path relative to the directory of the Path
   *
   * https://nodejs.org/api/path.html#path_path_relative_from_to
   * @param	{string} what
   * @returns {string} relative
   */
    relative(what) {
        var isAbsolute = what && what.indexOf('://') > -1

        if (isAbsolute) {
            return what
        }

        return path.relative(this.directory, what)
    }

    splitPath(filename) {
        return this.splitPathRe.exec(filename).slice(1)
    }

    /**
   * Return the path string
   * @returns {string} path
   */
    toString() {
        return this.path
    }
}

export function request(url, type, withCredentials, headers) {
    var supportsURL = typeof window != 'undefined' ? window.URL : false // TODO: fallback for url if window isn't defined
    var BLOB_RESPONSE = supportsURL ? 'blob' : 'arraybuffer'

    var deferred = new defer()

    var xhr = new XMLHttpRequest()

    //-- Check from PDF.js:
    //   https://github.com/mozilla/pdf.js/blob/master/web/compatibility.js
    var xhrPrototype = XMLHttpRequest.prototype

    var header

    if (!('overrideMimeType' in xhrPrototype)) {
    // IE10 might have response, but not overrideMimeType
        Object.defineProperty(xhrPrototype, 'overrideMimeType', {
            value: function xmlHttpRequestOverrideMimeType() {},
        })
    }

    if (withCredentials) {
        xhr.withCredentials = true
    }

    xhr.onreadystatechange = handler
    xhr.onerror = err

    xhr.open('GET', url, true)

    // window.ReactNativeWebView.postMessage(
    //   JSON.stringify({ type: "epubjs", message: "[REQUEST] " + url })
    // );

    for (header in headers) {
        xhr.setRequestHeader(header, headers[header])
    }

    if (type == 'json') {
        xhr.setRequestHeader('Accept', 'application/json')
    }

    // If type isn"t set, determine it from the file extension
    if (!type) {
        type = new Path(url).extension
    }

    if (type == 'blob') {
        xhr.responseType = BLOB_RESPONSE
    }

    if (isXml(type)) {
    // xhr.responseType = "document";
        xhr.overrideMimeType('text/xml') // for OPF parsing
    }

    if (type == 'xhtml') {
    // xhr.responseType = "document";
    }

    if (type == 'html' || type == 'htm') {
    // xhr.responseType = "document";
    }

    if (type == 'binary') {
        xhr.responseType = 'arraybuffer'
    }

    xhr.send()

    function err(e) {
        deferred.reject(e)
    }

    function handler() {
        if (this.readyState === XMLHttpRequest.DONE) {
            // reactMessage("[REQUEST_HANDLER] STARTING...");
            var responseXML = false

            if (this.responseType === '' || this.responseType === 'document') {
                responseXML = this.responseXML
            }

            // reactMessage(`[REQUEST_HANDLER] ${this.responseType} ${this.response}`);

            if (this.status === 200 || this.status === 0 || responseXML) {
                //-- Firefox is reporting 0 for blob urls
                var r

                if (!this.response && !responseXML) {
                    deferred.reject({
                        status: this.status,
                        message: 'Empty Response',
                        stack: new Error().stack,
                    })
                    return deferred.promise
                }

                if (this.status === 403) {
                    deferred.reject({
                        status: this.status,
                        response: this.response,
                        message: 'Forbidden',
                        stack: new Error().stack,
                    })
                    return deferred.promise
                }
                if (responseXML) {
                    r = this.responseXML
                } else if (isXml(type)) {
                    // xhr.overrideMimeType("text/xml"); // for OPF parsing
                    // If this.responseXML wasn't set, try to parse using a DOMParser from text
                    r = parse(this.response, 'text/xml')
                } else if (type == 'xhtml') {
                    r = parse(this.response, 'application/xhtml+xml')
                } else if (type == 'html' || type == 'htm') {
                    r = parse(this.response, 'text/html')
                } else if (type == 'json') {
                    r = JSON.parse(this.response)
                } else if (type == 'blob') {
                    if (supportsURL) {
                        r = this.response
                    } else {
                        //-- Safari doesn't support responseType blob, so create a blob from arraybuffer
                        r = new Blob([this.response])
                    }
                } else {
                    r = this.response
                }
                // reactMessage(`[REQUEST_HANDLER] END of DEFF ${r}`);

                deferred.resolve(r)
            } else {
                deferred.reject({
                    status: this.status,
                    message: this.response,
                    stack: new Error().stack,
                })
            }
        }
    }

    return deferred.promise
}
