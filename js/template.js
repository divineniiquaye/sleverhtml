/*! template.js | MIT License | (c) 2019 Divine Niiquaye */

"use strict";

(function(factory) {
    const docType = "<!DOCTYPE html>";

    if (typeof define == "function" && define.amd)
        // AMD; RequireJS
        define(["jsdom", "./slever"], function(jsdom, slever) {
            return Object.assign(
                slever,
                factory(new jsdom.JSDOM(docType).window)
            );
        });
    else if (typeof module == "object" && module.exports) {
        // CommonJS
        module.exports = Object.assign(
            require("./slever"),
            factory(new (require("jsdom")).JSDOM(docType).window)
        );
    }
    // Browser
    else window.slever = Object.assign(window.slever, factory(window));
})(function(window) {
    /**
     * Pre-processors
     */
    var _config = {
        html: void 0,
        js: void 0,
        css: void 0
    };

    /**
     * Override default settings
     * @param object settings
     */
    function config(settings) {
        if (settings)
            for (var key in settings)
                if (settings.hasOwnProperty(key)) _config[key] = settings[key];
        return this;
    }

    /**
     * Find DOM elements that match specified CSS selector
     * @return array
     * @param string selector
     * @param element context
     */
    function $(selector, context) {
        return [].slice.call(
            (context || window.document).querySelectorAll(selector)
        );
    }

    /**
     * Template block handlers
     */
    const cmd = {
        /**
         * Traverse array and return equivalent ES6+ literal
         * @return string
         * @param string expr
         * @param string block
         */
        _foreach(expr, block) {
            let match;
            if ((match = expr.match(/(.+)\s+as\s+(?:(.+):)?(.+)/)))
                return (
                    "${" +
                    match[1] +
                    ".map(" +
                    "function(" +
                    match[3] +
                    (match[2] ? "," + match[2] : "") +
                    ") {\n" +
                    "return (`" +
                    block +
                    "`)" +
                    "})." +
                    "join(`\\n`)" +
                    "}"
                );
            else throw new ReferenceError(expr);
        },
        /**
         * Transform if..else block to ES6+ literal ternary expression
         * @return string
         * @param string expr
         * @param string block
         */
        _if(expr, block) {
            let html = "${" + expr + "?",
                fallback = false,
                match;
            while ((match = block.match(/#else(?:\s+if\s*\((.+)\))?\s*:/))) {
                html += "`" + block.substring(0, match.index).trim() + "`:";
                if (match[1]) html += match[1] + "?";
                else fallback = true;
                block = block.substring(match.index + match[0].length);
            }
            return (
                html + "`" + block.trim() + "`" + (fallback ? "" : ":``") + "}"
            );
        }
    };

    /**
     * Convert template blocks to regular Javascript
     * @return string
     * @param string html
     */
    function compile(html) {
        const regex = /#(\w+)\s+(?:\(\s*(.*?)\s*\))?(?=\s*\{)/;
        let level = 0,
            tree = [],
            branch,
            current,
            content,
            match,
            block;
        while ((match = html.match(/((?:#\w+\s.*?|\$)?\{)|(\})/))) {
            content = html.substr(0, match.index);
            if (match[1]) {
                tree.push([level, content], [level, match[1]]);
                level++;
            } else {
                tree.push([level, content]);
                // Roll-up to start of block
                while (tree[tree.length - 1][0] > level - 1) {
                    branch = tree.pop();
                    if (tree.length) {
                        current = tree[tree.length - 1];
                        if (current[0] == level - 1) {
                            // Start of block found
                            if ((block = current[1].match(regex))) {
                                const fn = cmd["_" + block[1]];
                                if (!fn) throw new SyntaxError(block[0]);
                                tree[tree.length - 1][1] = fn(
                                    block[2],
                                    branch[1]
                                );
                                branch[1] = "";
                            } else branch[1] += match[2];
                        }
                        tree[tree.length - 1][1] += branch[1];
                    } else throw new SyntaxError(match[2]);
                }
                level--;
            }
            html = html.substring(match.index + match[0].length);
        }
        tree.push([level, html]);
        html = "";
        for (let i = 0, len = tree.length; i < len; i++) {
            if (tree[i][0]) throw new SyntaxError(tree[i - 1][1]);
            html += tree[i][1];
        }
        return html;
    }

    /**
     * Transpile to Javascript
     * @return string
     * @param string html
     * @param element context?
     */
    function transpile(html, context) {
        let result = "";
        if (!context) {
            let tmp = window.document.createElement("template");
            tmp.innerHTML = html;
            context = tmp.content;
        }
        [].slice.call(context.children).forEach(function(element) {
            let name = element.tagName.toLowerCase(),
                section = {
                    script: "",
                    style: ""
                };
            ["script", "style"].forEach(function(type) {
                $(type, element).forEach(function(tag) {
                    let content = tag.textContent.trim();
                    if (content) section[type] += content + "\n";
                    // Align with sourcemap
                    if (type == "script") tag.remove();
                    else tag.outerHTML = tag.innerHTML.replace(/[^\n]+/g, "");
                });
            });
            let raw = {
                html: element.outerHTML.trim(),
                js: section.script.trim(),
                css: section.style
                    .replace(/\s*([{}~>:;,\s])\s*/g, "$1")
                    .replace(/\/\*.+?\*\//g, "")
                    .trim()
            };
            for (var key in raw)
                if (_config[key]) raw[key] = _config[key](raw[key]);
            result +=
                "slever.register(" +
                '"' +
                name +
                '",' +
                "function(props) {" +
                "return (" +
                "`" +
                compile(raw.html) +
                "`" +
                ")" +
                "}," +
                "function(props,refs) {" +
                (raw.js || "") +
                "}," +
                "function(props) {" +
                "return (" +
                "`" +
                raw.css +
                "`" +
                ")" +
                "}" +
                ");\n";
        });
        return result || html;
    }

    /**
     * Process intrinsic components
     **/
    $('template[type="x-component"]').forEach(function(element) {
        let tmp = window.document.createElement("script");
        tmp.textContent = transpile(element.innerHTML);
        document.body.removeChild(document.body.appendChild(tmp));
        element.parentNode.removeChild(element);
    });

    return {
        transpile,
        config
    };
});
