const { renderDialogWindow } = require("./components");

function renderOptionsPage() {
  const title = "Developer Options";
  const header = "Developer Options";

  // The JSON polyfill is now required only here.
  const script = `
        if (typeof JSON !== 'object') {
            JSON = {};
        }
        (function () {
            'use strict';
            var rx_one = /^[\\],:{}\\s]*$/,
                rx_two = /\\\\(?:["\\\\\\/bfnrt]|u[0-9a-fA-F]{4})/g,
                rx_three = /"[^"\\\\\\n\\r]*"|true|false|null|-?\\d+(?:\\.\\d*)?(?:[eE][+\\-]?\\d+)?/g,
                rx_four = /(?:^|:|,)(?:\\s*\\[)+/g,
                rx_escapable = /[\\\\\\"\\u0000-\\u001f\\u007f-\\u009f\\u00ad\\u0600-\\u0604\\u070f\\u17b4\\u17b5\\u200c-\\u200f\\u2028-\\u202f\\u2060-\\u206f\\ufeff\\ufff0-\\uffff]/g,
                rx_dangerous = /[\\u0000\\u00ad\\u0600-\\u0604\\u070f\\u17b4\\u17b5\\u200c-\\u200f\\u2028-\\u202f\\u2060-\\u206f\\ufeff\\ufff0-\\uffff]/g;
            function f(n) {
                return n < 10 ? '0' + n : n;
            }
            function this_value() {
                return this.valueOf();
            }
            if (typeof Date.prototype.toJSON !== 'function') {
                Date.prototype.toJSON = function () {
                    return isFinite(this.valueOf())
                        ? this.getUTCFullYear() + '-' +
                                f(this.getUTCMonth() + 1) + '-' +
                                f(this.getUTCDate()) + 'T' +
                                f(this.getUTCHours()) + ':' +
                                f(this.getUTCMinutes()) + ':' +
                                f(this.getUTCSeconds()) + 'Z'
                        : null;
                };
                String.prototype.toJSON =
                    Number.prototype.toJSON =
                    Boolean.prototype.toJSON = this_value;
            }
            var gap,
                indent,
                meta,
                rep;
            function quote(string) {
                rx_escapable.lastIndex = 0;
                return rx_escapable.test(string)
                    ? '"' + string.replace(rx_escapable, function (a) {
                        var c = meta[a];
                        return typeof c === 'string'
                            ? c
                            : '\\\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
                    }) + '"'
                    : '"' + string + '"';
            }
            function str(key, holder) {
                var i, k, v, length, mind = gap, partial, value = holder[key];
                if (value && typeof value === 'object' &&
                        typeof value.toJSON === 'function') {
                    value = value.toJSON(key);
                }
                if (typeof rep === 'function') {
                    value = rep.call(holder, key, value);
                }
                switch (typeof value) {
                case 'string':
                    return quote(value);
                case 'number':
                    return isFinite(value) ? String(value) : 'null';
                case 'boolean':
                case 'null':
                    return String(value);
                case 'object':
                    if (!value) {
                        return 'null';
                    }
                    gap += indent;
                    partial = [];
                    if (Object.prototype.toString.apply(value) === '[object Array]') {
                        length = value.length;
                        for (i = 0; i < length; i += 1) {
                            partial[i] = str(i, value) || 'null';
                        }
                        v = partial.length === 0
                            ? '[]'
                            : gap
                                ? '[\\n' + gap + partial.join(',\\n' + gap) + '\\n' + mind + ']'
                                : '[' + partial.join(',') + ']';
                        gap = mind;
                        return v;
                    }
                    if (rep && typeof rep === 'object') {
                        length = rep.length;
                        for (i = 0; i < length; i += 1) {
                            if (typeof rep[i] === 'string') {
                                k = rep[i];
                                v = str(k, value);
                                if (v) {
                                    partial.push(quote(k) + (gap ? ': ' : ':') + v);
                                }
                            }
                        }
                    } else {
                        for (k in value) {
                            if (Object.prototype.hasOwnProperty.call(value, k)) {
                                v = str(k, value);
                                if (v) {
                                    partial.push(quote(k) + (gap ? ': ' : ':') + v);
                                }
                            }
                        }
                    }
                    v = partial.length === 0
                        ? '{}'
                        : gap
                            ? '{\\n' + gap + partial.join(',\\n' + gap) + '\\n' + mind + '}'
                            : '{' + partial.join(',') + '}';
                    gap = mind;
                    return v;
                }
            }
            if (typeof JSON.stringify !== 'function') {
                meta = {
                    '\\b': '\\\\b', '\\t': '\\\\t', '\\n': '\\\\n', '\\f': '\\\\f',
                    '\\r': '\\\\r', '"': '\\\\"', '\\\\': '\\\\\\\\'
                };
                JSON.stringify = function (value, replacer, space) {
                    var i;
                    gap = '';
                    indent = '';
                    if (typeof space === 'number') {
                        for (i = 0; i < space; i += 1) {
                            indent += ' ';
                        }
                    } else if (typeof space === 'string') {
                        indent = space;
                    }
                    rep = replacer;
                    if (replacer && typeof replacer !== 'function' &&
                            (typeof replacer !== 'object' ||
                            typeof replacer.length !== 'number')) {
                        throw new Error('JSON.stringify');
                    }
                    return str('', {'': value});
                };
            }
            if (typeof JSON.parse !== 'function') {
                JSON.parse = function (text, reviver) {
                    var j;
                    function walk(holder, key) {
                        var k, v, value = holder[key];
                        if (value && typeof value === 'object') {
                            for (k in value) {
                                if (Object.prototype.hasOwnProperty.call(value, k)) {
                                    v = walk(value, k);
                                    if (v !== undefined) {
                                        value[k] = v;
                                    } else {
                                        delete value[k];
                                    }
                                }
                            }
                        }
                        return reviver.call(holder, key, value);
                    }
                    text = String(text);
                    rx_dangerous.lastIndex = 0;
                    if (rx_dangerous.test(text)) {
                        text = text.replace(rx_dangerous, function (a) {
                            return '\\\\u' +
                                    ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
                        });
                    }
                    if (
                        rx_one.test(
                            text
                                .replace(rx_two, '@')
                                .replace(rx_three, ']')
                                .replace(rx_four, '')
                        )
                    ) {
                        j = eval('(' + text + ')');
                        return typeof reviver === 'function'
                            ? walk({'': j}, '')
                            : j;
                    }
                    throw new SyntaxError('JSON.parse');
                };
            }
        }());

        function setCookie(name, value, days) {
            var expires = "";
            if (days) {
                var date = new Date();
                date.setTime(date.getTime() + (days*24*60*60*1000));
                expires = "; expires=" + date.toUTCString();
            }
            document.cookie = name + "=" + (value || "")  + expires + "; path=/";
        }

        function getCheckedRadioValue(name) {
            var radios = document.getElementsByName(name);
            for (var i = 0, length = radios.length; i < length; i++) {
                if (radios[i].checked) {
                    return radios[i].value;
                }
            }
            return null;
        }

        window.saveOptions = function() {
            var relLevel = getCheckedRadioValue('rel-level');
            var options = {
                showScores: document.getElementById('show-scores').checked,
                resetApplication: document.getElementById('reset-application').checked,
                relationshipLevel: relLevel ? parseInt(relLevel, 10) : -1
            };
            setCookie('icq98_options', JSON.stringify(options), 1);
            
            alert("Options have been saved. They will be applied the next time you log in.");
            window.close();
        }
    `;

  const bodyContent = `
        <p>These settings will be applied to your profile the <b>next time you log in</b>.</p>
        
        <div style="border: 1px solid #808080; padding: 10px; margin-bottom: 15px;">
            <legend style="font-weight: bold;">Display Settings</legend>
            <div style="margin-bottom: 10px;">
                <input type="checkbox" id="show-scores">
                <label for="show-scores">Display relationship scores in chat window</label>
            </div>
        </div>

        <div style="border: 1px solid #808080; padding: 10px; margin-bottom: 15px;">
            <legend style="font-weight: bold;">Relationship Cheats</legend>
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px;">Set all relationship scores to:</label>
                <div style="display: inline; margin-right: 10px;">
                    <input type="radio" name="rel-level" value="-1" id="rel-none" checked><label for="rel-none">No Change</label>
                    <input type="radio" name="rel-level" value="10" id="rel-10"><label for="rel-10">10</label>
                    <input type="radio" name="rel-level" value="50" id="rel-50"><label for="rel-50">50</label>
                    <input type="radio" name="rel-level" value="90" id="rel-90"><label for="rel-90">90</label>
                </div>
            </div>
        </div>

        <div style="border: 1px solid #808080; padding: 10px; margin-bottom: 15px;">
            <legend style="font-weight: bold;">Reset Application</legend>
            <div style="margin-bottom: 10px;">
                <input type="checkbox" id="reset-application">
                <label for="reset-application">This will delete all user profiles (DANGEROUS!)</label>
                <p style="font-size: 11px; color: #505050; margin-top: 5px; margin-left: 20px; margin-bottom: 0;">This will delete all users, including the power admin, and you'll need to start over.</p>
            </div>
        </div>

        <div class="button-container">
            <input type="button" value="Save &amp; Return" onclick="window.saveOptions()">
            <a href="#" onclick="window.close(); return false;">Cancel</a>
        </div>
    `;
  return renderDialogWindow({ title, header, bodyContent, scripts: script });
}

module.exports = {
  renderOptionsPage,
};
