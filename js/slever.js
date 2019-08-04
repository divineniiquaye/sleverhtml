/*! slever.js | MIT License | (c) 2019 Divine Niiquaye */

"use strict";

(function(factory) {
    if (typeof define == "function" && define.amd)
        // AMD; RequireJS
        define(factory);
    else if (typeof module == "object" && module.exports)
        // CommonJS
        module.exports = factory();
    // Browser
    else window.slever = factory();
})(function() {
    let _tag = "tag", // Component glue point
        _ref = "ref", // Reference to HTML element
        _glue = "glue", // Glue tag
        _reg = {}; // Component registry

    /**
     * Traverse DOM tree
     * @param object strategy
     * @param element context
     */
    function traverse(strategy, context) {
        let self = context,
            flag = false;
        while (self) {
            if (!flag) {
                // Pre-order strategy
                if (strategy.pre) strategy.pre(self, flag);
                if (self.firstElementChild) {
                    flag = false;
                    self = self.firstElementChild;
                    continue;
                }
            }
            // Post-order strategy
            if (strategy.post) strategy.post(self, flag);
            if (self.isSameNode(context)) break;
            flag = false;
            if (self.nextElementSibling) self = self.nextElementSibling;
            else {
                flag = true;
                self = self.parentElement;
            }
        }
    }

    /**
     * Find DOM elements that match specified CSS selector
     * @return array
     * @param string selector
     * @param element context
     */
    function $(selector, context) {
        return [].slice.call((context || document).querySelectorAll(selector));
    }

    /**
     * Component properties
     * @constructor
     * @param object data?
     */
    function Props(data) {
        if (data) this.save(data);
    }

    Props.prototype = {
        /**
         * Save properties
         * @param object data
         * @param boolean override?
         */
        save(data, override) {
            override = override == void 0 || override;
            if (typeof data == "object")
                for (let key in data)
                    data.hasOwnProperty(key) &&
                        (!this.hasOwnProperty(key) || override) &&
                        (this[key] = data[key]);
        }
    };

    /**
     * HTML element reference
     * @constructor
     * @param element element
     * @param function fn?
     */
    function Ref(element, fn) {
        let self = this;
        Object.setPrototypeOf(this, {
            /**
             * Add event listener
             * @return object
             * @param string type
             * @param function fn
             * @param object options?
             */
            on(type, fn, options) {
                type.split(" ").forEach(
                    function(e) {
                        this._raw.addEventListener(e, fn.bind(this), options);
                    }.bind(this)
                );
                return this;
            },
            /**
             * Remove event listener
             * @return object
             * @param string type
             * @param function fn
             * @param object options?
             */
            off(type, fn, options) {
                type.split(" ").forEach(
                    function(e) {
                        this._raw.removeEventListener(
                            e,
                            fn.bind(this),
                            options
                        );
                    }.bind(this)
                );
                return this;
            },
            /**
             * Add single-use event listener
             * @return object
             * @param string type
             * @param function fn
             * @param object options?
             */
            once(type, fn, options) {
                type.split(" ").forEach(
                    function(e) {
                        var cb = function() {
                            fn.call(this);
                            this._raw.removeEventListener(e, cb, options);
                        }.bind(this);
                        this._raw.addEventListener(e, cb, options);
                    }.bind(this)
                );
                return this;
            },
            /**
             * Dispatch an event
             * @return object
             * @param string type
             * @param scalar|object detail
             */
            emit(type, detail) {
                type.split(" ").forEach(
                    function(e) {
                        this._raw.dispatchEvent(
                            new CustomEvent(type, { detail })
                        );
                    }.bind(this)
                );
                return this;
            },
            /**
             * Find elements that match CSS selector
             * @return array
             * @param string selector
             */
            find(selector) {
                let out = [];
                $(selector, this._raw).forEach(function(element) {
                    out.push(new Ref(element));
                });
                return out;
            },
            /**
             * Return next sibling; Match CSS selector if specified
             * @param object|undefined
             * @param string selector
             */
            next(selector) {
                let element = this._raw,
                    sibling;
                while ((sibling = element.nextElementSibling)) {
                    if (!selector || sibling.matches(selector)) break;
                    element = element.nextElementSibling;
                }
                return sibling ? new Ref(sibling) : void 0;
            },
            /**
             * Return previous sibling; Match CSS selector if specified
             * @param object|undefined
             * @param string selector
             */
            prev(selector) {
                let element = this._raw,
                    sibling;
                while ((sibling = element.previousElementSibling)) {
                    if (!selector || sibling.matches(selector)) break;
                    element = element.previousElementSibling;
                }
                return sibling ? new Ref(sibling) : void 0;
            },
            /**
             * Inject properties into this element
             * @return object
             * @param object data
             */
            inject(data) {
                let element = this._raw;
                if (element.hasOwnProperty("_props")) {
                    let prior = element._props,
                        changed = false;
                    // Detect changes
                    for (let key in data)
                        if (
                            prior.hasOwnProperty(key) &&
                            data.hasOwnProperty(key) &&
                            prior[key] != data[key]
                        ) {
                            changed = true;
                            break;
                        }
                    element._props.save(data);
                    escalate(element);
                    if (changed)
                        // Cascade changes
                        traverse(
                            {
                                pre(self) {
                                    if (self.hasOwnProperty("_props")) {
                                        self._props.save(data);
                                        self.dispatchEvent(
                                            new CustomEvent("update")
                                        );
                                    }
                                }
                            },
                            element
                        );
                } else element._props = new Props(data);
                return this;
            },
            /**
             * Expose underlying HTML element of specified Ref
             * @return object|undefined
             * @param object ref
             */
            expose(ref) {
                if (!ref) ref = this;
                return ref._raw && this._raw.contains(ref._raw)
                    ? ref._raw
                    : void 0;
            },
            /**
             * Detach component
             * @return object
             */
            unload() {
                unload(this._raw);
                return this;
            },
            /**
             * Attach component
             * @return object
             * @param object data?
             */
            load(data) {
                let element = this._raw;
                load(data || element._props, element);
                return this;
            },
            /**
             * Reload component
             * @return object
             * @param object data?
             */
            reload(data) {
                this.unload();
                this.load(data);
                return this;
            },
            /**
             * Set tag attribute if not exists and add name to tag attribute
             * @param string name
             */
            addTag(name) {
                let element = self._raw,
                    tag = element.getAttribute(_tag);
                if (!tag || tag.split(" ").indexOf(name) < 0)
                    element.setAttribute(
                        _tag,
                        ((tag || "") + " " + name).trim()
                    );
                // Inherit props
                let parent = element.parentElement;
                while (parent && !parent._props) parent = parent.parentElement;
                if (!element.hasOwnProperty("_props"))
                    element._props = new Props();
                if (parent) element._props.save(parent._props);
                return self;
            },
            /**
             * Remove name from tag attribute
             * @param string name
             */
            removeTag(name) {
                let element = self._raw,
                    tag = element.getAttribute(_tag),
                    re = new RegExp("(?<=^|s)" + name + "(?=s|$)");
                element.setAttribute(_tag, tag.replace(re, ""));
                return self;
            },
            /**
             * Make the raw HTML element private/obscure
             */
            _raw: element
        });
        if (fn) fn.call(this, element._props, element._refs);
    }

    /**
     * Escalate properties of element
     * @param element
     */
    function escalate(target) {
        let parent = target._parent;
        if (parent)
            for (let i in parent._refs)
                if (target.isSameNode(parent._refs[i]._raw)) {
                    // Parent has a Ref pointing to this element
                    for (let j in target._props)
                        if (target._props.hasOwnProperty(j))
                            parent._refs[i][j] = target._props[j];
                    if (target.isSameNode(parent)) escalate(parent);
                    break;
                }
    }

    /**
     * Style the specified component
     * @param object props
     * @param function content
     */
    function style(props, content) {
        let css = content.call(this, props).trim();
        if (css) {
            let tmp = document.createElement("template");
            tmp.innerHTML = "<style>" + css + "</style>";
            document.head.appendChild(tmp.content);
        }
    }

    /**
     * Merge attributes of source and destination elements
     * @param element src
     * @param element dest
     */
    function merge(src, dest) {
        let attr = src.attributes;
        for (let i = 0, len = attr.length; i < len; i++) {
            attr[i].value = attr[i].value.trim();
            if (attr[i].name == "class")
                dest.classList.add.apply(
                    dest.classList,
                    attr[i].value.split(" ")
                );
            else dest.setAttribute(attr[i].name, attr[i].value);
        }
    }

    /**
     * Attach component (and subcomponents)
     * @param object data?
     * @param element root?
     */
    function load(data, root) {
        root = root || document.documentElement;
        ourMeta();
        includeComponent();
        let tree = [],
            parent;
        traverse(
            {
                pre(self) {
                    if (self.hasAttribute(_tag)) {
                        self.getAttribute(_tag)
                            .split(" ")
                            .forEach(function(name) {
                                if (_reg[name]) {
                                    // Find the parent component
                                    parent = tree[tree.length - 1];
                                    if (parent)
                                        while (!parent.contains(self)) {
                                            tree.pop();
                                            parent = tree[tree.length - 1];
                                        }
                                    self._parent = parent;
                                    // Initialize props and auto-inherit properties
                                    self._props = self._props || new Props();
                                    self._props.save(
                                        parent ? parent._props : data,
                                        false
                                    );
                                    // Initialize refs and escalate properties
                                    self._refs = {};
                                    if (parent) escalate(self);
                                    tree.push(self);
                                    // Instantate the component
                                    (function instantiate(name) {
                                        if (
                                            !self._tag ||
                                            self._tag.split(" ").indexOf(name) <
                                                0
                                        )
                                            self._tag = (
                                                (self._tag || "") +
                                                " " +
                                                name
                                            ).trim();
                                        let com = new Ref(self, _reg[name].fn);
                                        // JIT-load CSS
                                        if (
                                            !_reg[name].css.loaded &&
                                            _reg[name].css.content
                                        ) {
                                            style.call(
                                                com,
                                                self._props,
                                                _reg[name].css.content
                                            );
                                            _reg[name].css.loaded = true;
                                        }
                                        let tmp = document.createElement(
                                            "template"
                                        );
                                        tmp.innerHTML = _reg[name].html.call(
                                            com,
                                            self._props
                                        );
                                        // Glue the component instance
                                        let frag = document.createDocumentFragment(),
                                            glue = $(_glue, tmp.content);
                                        if (glue.length) {
                                            while (self.firstChild)
                                                frag.appendChild(
                                                    self.firstChild
                                                );
                                            glue[0].parentElement.replaceChild(
                                                frag,
                                                glue[0]
                                            );
                                            glue.forEach(function(node) {
                                                node.remove();
                                            });
                                        }
                                        // Merge attributes with host element
                                        let tag = tmp.content.firstElementChild;
                                        merge(tag, self);
                                        while (tag.firstChild)
                                            if (
                                                tag.firstChild.nodeType !=
                                                    window.Node.TEXT_NODE ||
                                                tag.firstChild.textContent.trim()
                                            )
                                                frag.appendChild(
                                                    tag.firstChild
                                                );
                                            // Trim whitespace
                                            else tag.firstChild.remove();
                                        self.insertBefore(
                                            frag,
                                            self.firstElementChild
                                        );
                                        // Process refs
                                        let refs = $("[" + _ref + "]", self);
                                        if (self.hasAttribute(_ref))
                                            refs.push(self);
                                        refs.forEach(function(ref) {
                                            self._refs[
                                                ref.getAttribute(_ref)
                                            ] = new Ref(ref);
                                            ref.removeAttribute(_ref);
                                        });
                                        if (tag.hasAttribute(_tag))
                                            tag.getAttribute(_tag)
                                                .split(" ")
                                                .forEach(function(name) {
                                                    instantiate(name);
                                                });
                                    })(name);
                                }
                            });
                        self.dispatchEvent(new CustomEvent("ready"));
                        self.removeAttribute(_tag);
                    }
                }
            },
            root
        );
    }

    /**
     * Detach component (and subcomponents)
     * @param element root?
     */
    function unload(root) {
        traverse(
            {
                post(self) {
                    self.dispatchEvent(new CustomEvent("unload"));
                    if (!self.getAttribute(_tag) && self._tag) {
                        self.setAttribute(_tag, self._tag);
                        delete self._tag;
                    }
                    while (self.lastChild) self.removeChild(self.lastChild);
                }
            },
            root || window.document.documentElement
        );
    }

    /**
     * Select an element in the html Dom
     * @param {string} element
     * @param {boolean} all
     */
    function selector(element, all = false) {
        if (true == all) {
            return document.querySelectorAll(element);
        }
        if (false == all) {
            return document.querySelector(element);
        }
    }

    /**
     * Get the data from a url or file using ajax
     * @param {string} url
     * @param {string} open
     * @param {string} type
     * @param callback
     */
    function request(url, open, type, callback) {
        var request = Browser.Request();
        if (open == null) var opentype = "GET";
        if (type == null) var rtype = "json";

        var cookie = new Cookie("user_platform");
        cookie.write(Browser.platform);

        request.open(opentype || open, url);
        request.responseType = rtype || type;
        request.send();

        request.onreadystatechange = function() {
            if (request.readyState === 4 && request.status === 200) {
                callback(request.response);
            }
        };
    }

    /**
     * The slever component importer
     * @param {string} content Requires a file in .shf format
     */
    function importComponent(content) {
        var value = document.createElement('div');
        value.setAttribute('import-component', 'component/' + content + '.shf');

        document.body.appendChild(value);
    }

    function includeComponent() {
        var z, i, elmnt, file, xhttp;
        /*loop through a collection of all HTML elements:*/
        z = document.getElementsByTagName("*");
        for (i = 0; i < z.length; i++) {
            elmnt = z[i];
            /*search for elements with a certain atrribute:*/
            file = elmnt.getAttribute("import-component");
            if (file) {
                /*make an HTTP request using the attribute value as the file name:*/
                fetch(file).then(function(response) {
                    response.text().then(function(text) {
                        if (response.status == 200) {
                            elmnt.innerHTML = text;
                        }
                        if (response.status == 404) {
                            elmnt.innerHTML = "Component not found.";
                        }
                        /*remove the attribute, and call this function once more:*/
                        elmnt.removeAttribute("import-component");
                        includeComponent();
                    });
                  });
                /*exit the function:*/
                return;
            }
        }
    }

    // Public: Find version identifier for the initial page load.
    //
    // Returns String version or undefined.
    function ourMeta() {
        var node = document.createElement("meta");
        node.setAttribute("http-equiv", "X-SLEVER");
        node.setAttribute("content", "0.1.1");

        document.head.appendChild(node);
    }

    return {
        /**
         * Configure router
         * @param config
         */
        router(config) {},
        /**
         * Register a component
         * @param string name
         * @param string html
         * @param function fn
         * @param string css
         */
        register(name, html, fn, css) {
            fn.prototype = Ref;
            _reg[name] = {
                html,
                fn,
                css: {
                    content: css,
                    loaded: true
                }
            };
        },
        /**
         * Exposed methods
         */
        load,
        unload,
        request,
        selector,
        importComponent
    };
});
