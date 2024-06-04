// subordinate types for circularly-dependent Renderer and OutputContext types

import {
    clear_element,
    scroll_element_into_view,
    set_element_attrs,
    update_element_style,
    create_element_or_mapping,
    create_element,
    create_element_mapping,
    delay_ms        as tools_delay_ms,
    next_tick       as tools_next_tick,
    next_micro_tick as tools_next_micro_tick,
} from 'lib/ui/dom-tools';

import {
    sprintf as lib_sprintf,
} from 'lib/sys/sprintf';

import {
    SerialDataSource,
} from 'lib/sys/serial-data-source';

import {
    ActivityManager,
} from 'lib/sys/activity-manager';

import {
    TextOrientedRendererOptionsType,
} from 'src/renderer/text/types';

import {
    ErrorRendererValueType,
    ErrorRendererOptionsType,
    ImageDataRendererValueType,
    ImageDataRendererOptionsType,
    GraphvizRendererValueType,
    GraphvizRendererOptionsType,
    PlotlyRendererValueType,
    PlotlyRendererOptionsType,
    CanvasImageRendererValueType,
    CanvasImageRendererOptionsType,
} from 'src/renderer/application/types';


// This is a recognizable error representing a stopped condition
export class StoppedError extends Error {};


export abstract class OutputContextLike extends ActivityManager {
    get CLASS (){ return this.constructor as typeof OutputContextLike; }

    abstract get parent  (): undefined|OutputContextLike;
    abstract get element (): Element;

    #keepalive: boolean = false;
    get keepalive (){ return this.#keepalive; }
    set keepalive (new_state: boolean){
        // set for this ocx and all ancestors
        this.#keepalive = new_state;
        if (this.parent) {
            this.parent.keepalive = new_state;  // recusively sets for all ancestors
        }
    }


    // === STATIC UTILITY ===

    static sprintf(format: string, ...args: any[]): string {
        return lib_sprintf(format, ...args);
    }

    static async sleep(s: number): Promise<void> {
        return tools_delay_ms(1000*s);
    }

    static async delay_ms(ms: number): Promise<void> {
        return tools_delay_ms(ms);
    }

    static async next_tick(): Promise<void> {
        return tools_next_tick();
    }

    static async next_micro_tick(): Promise<void> {
        return tools_next_micro_tick();
    }


    // === STATIC OPERATIONS ===

    static get_svg_string(svg_node: Node): string {
        const serializer = new XMLSerializer();
        let svg_string = serializer.serializeToString(svg_node);
        svg_string = svg_string.replace(/(\w+)?:?xlink=/g, 'xmlns:xlink=');  // fix root xlink without namespace
        svg_string = svg_string.replace(/NS\d+:href/g, 'xlink:href');  // Safari NS namespace fix
        return svg_string;
    }

    /** remove all child elements and nodes of element
     *  @param {Node} element
     *  @return {Node} element
     */
    static clear_element(element: Node): void {
        clear_element(element);
    }

    /** scroll element into view
     *  @param {Element} element
     *  @return {Element} element
     */
    static scroll_element_into_view(element: Element): void {
        scroll_element_into_view(element);
    }

    /** set attributes on an element which are taken from an object.
     *  @param {Element} element
     *  @param {Object|undefined|null} attrs
     *  @return {Element} element
     *  Attribute values obtained by calling toString() on the values in attrs
     *  except that values which are undefined are translated to ''.
     */
    static set_element_attrs(element: Element, attrs: { [attr: string]: undefined|null|string }): void {
        set_element_attrs(element, attrs);
    }

    /** add/remove style properties on element
     *  @param {HTMLElement} element
     *  @param {Object} spec collection of properties to add or remove.
     *                  If the value of an entry is null or undefined, then
     *                  the corresponding property is removed.  If the value
     *                  of an entry is null, then the property is removed.
     *                  If the value of an entry is undefined, then that
     *                  entry is ignored.  Otherwise, the value of the
     *                  corresponding property is set.
     *  @return {HTMLElement} element
     */
    static update_element_style(element: HTMLElement, spec: { [prop: string]: undefined|null|string }): void {
        update_element_style(element, spec);
    }

    /** create_element_or_mapping(options?: object, return_mapping=false)
     *  create a new element with the given characteristics
     *  @param {Object|undefined|null} options: {
     *      _key?:      String,     // if return_mapping, associate the created element with this value as the key
     *      parent?:    Node|null,  // parent element, null or undefined for none; may be simply an Element if style not specified
     *      before?:    Node|null,  // sibling node before which to insert; append if null or undefined
     *      tag?:       string,     // tag name for new element; default: 'div'
     *      namespace?: string,     // namespace for new element creation
     *      attrs?:     object,     // attributes to set on new element
     *      style?:     object,     // style properties for new element
     *      set_id?:    Boolean     // if true, allocate and set an id for the element (if id not specified in attrs)
     *      children?:  ELDEF[],    // array of children to create (recursive)
     *      innerText?: string,     // innerText to set on element (invalid if "children" or "innerHTML" specified)
     *      innerHTML?: string,     // innerHTML to set on element (invalid if "children" or "innerText" specified)
     *  }
     *  @param {Boolean} return_mapping (default false)
     *  @return {Element|Object} the new element or the element mapping object
     *
     * A unique id will be assigned to the element unless that element already has
     * an id attribute specified (in attrs).
     * Attributes specified in attrs with a value of undefined are ignored.
     * The before node, if specified, must have a parent that must match parent if
     * parent is specified.
     * If neither parent nor before is specified, the new element will have no parent.
     * Warning: '!important' in style specifications does not work!  (Should use priority method.)
     * The definitions in "children", if specified, should not contain "parent" or "before".
     * attrs may contain a "class" property, and this should be a string or an array of strings,
     * each of which must not contain whitespace.
     *
     * If return_mapping, then return a mapping object from keys found in "_key" properties
     * in the options.  Each of these keys will be mapped to the corresponding object, and
     * mapping_default_key is mapped to the top-level object.  Note that duplicate keys or
     * keys that specify the same value as mapping_default_key will overwrite earlier values.
     * Elements specified in options are created in a post-order traversal of options.children.
     * This means that a _key specified in options as mapping_default_key will not be returned
     * because mapping_default_key is set after traversiing the children.
     */
    static create_element_or_mapping(options?: object, return_mapping: boolean = false): Element|object {
        return create_element_or_mapping(options, return_mapping);
    }

    static create_element(options?: object): Element {
        return create_element(options);
    }

    /** create a element with the given characteristics and return a mapping.
     *  See this.create_element() for a description of options.
     */
    static create_element_mapping(options?: object): object {
        return create_element_mapping(options);
    }

    /** create a new child element of the given element with the given characteristics
     *  See this.create_element_or_mapping() for a description of options.
     */
    static create_element_child_or_mapping(element: Node, options?: object, return_mapping: boolean = false): Element|object {
        if (typeof (options as any)?.parent !== 'undefined' || typeof (options as any)?.before !== 'undefined') {
            console.warn('options.parent and/or options.before override element argument');
        } else {
            options = {
                ...(options ?? {}),
                parent: element,
                before: null,
            };
        }
        return create_element_or_mapping(options, return_mapping);
    }

    /** create a new child element of the given element with the given characteristics and return a mapping.
     *  See create_element_mapping() for a description of options.
     */
    static create_element_child(element: Node, options?: object): Element {
        return this.create_element_child_or_mapping(element, options) as Element;
    }

    /** create a new child element of the given element with the given characteristics and return a mapping.
     *  See create_element_mapping() for a description of options.
     */
    static create_element_child_mapping(element: Node, options?: object): object {
        return this.create_element_child_or_mapping(element, options, true);
    }


    // === ABORT IF STOPPED ===

    /** abort by throwing an error if this.stopped, otherwise do nothing.
     */
    abort_if_stopped(operation?: string): void {
        if (this.stopped) {
            const stopped_message = this.keepalive ? 'stopped' : 'stopped (keepalive not set)';
            const message = operation ? `${operation}: ${stopped_message}` : stopped_message;
            throw new StoppedError(message);
        }
    }

    /** wrap the given function so that when it is called,
     *  this.abort_if_stopped() will be called first to
     *  terminate rendering.
     */
    AIS(f: Function): Function {
        if (typeof f !== 'function') {
            throw new Error('f must be a function');
        }
        const AsyncFunction = (async () => {}).constructor;
        if (f instanceof AsyncFunction) {
            return async (...args: any[]): Promise<any> => {
                this.abort_if_stopped(f.name);
                const result = await f.apply(null, args);
                this.abort_if_stopped(f.name);
                return result;
            };
        } else {
            return (...args: any[]): any => {
                this.abort_if_stopped(f.name);
                const result = f.apply(null, args);
                this.abort_if_stopped(f.name);
                return result;
            };
        }
    }


    // === UTILITY ===

    /** @param {String} format
     *  @param {any[]} args
     *  @return {String} formatted string
     */
    sprintf(format: string, ...args: any[]): string {
        this.abort_if_stopped();
        return OutputContextLike.sprintf(format, ...args);
    }

    /** @param {Number} s delay in seconds
     *  @return {Promise} promise which will resolve after s seconds
     */
    async sleep(s: number): Promise<void> {
        this.abort_if_stopped();
        return OutputContextLike.delay_ms(1000*s);
    }

    /** @param {Number} ms delay in milliseconds
     *  @return {Promise} promise which will resolve after ms milliseconds
     */
    async delay_ms(ms: number): Promise<void> {
        this.abort_if_stopped();
        return OutputContextLike.delay_ms(ms);
    }

    /** @return {Promise} promise which will resolve after next "tick"
     * setTimeout() is used.
     */
    async next_tick(): Promise<void> {
        this.abort_if_stopped();
        return OutputContextLike.next_tick();
    }

    /** @return {Promise} promise which will resolve after next "tick"
     * queueMicrotask() is used.
     */
    async next_micro_tick(): Promise<void> {
        this.abort_if_stopped();
        return OutputContextLike.next_micro_tick();
    }


    // === BASIC OPERATIONS ===

    abstract clear(): void;
    abstract scroll_into_view(): void;
    abstract set_attrs(attrs: { [attr: string]: undefined|null|string }): void;
    abstract update_style(spec: { [prop: string]: undefined|null|string }): void;
    abstract create_child_or_mapping(options?: object, return_mapping?: boolean): Element|object;
    abstract create_child(options?: object): Element;
    abstract create_child_mapping(options?: object): object;
    abstract create_new_ocx(element: Element, parent?: OutputContextLike): OutputContextLike;
    abstract create_child_ocx(options?: object): OutputContextLike;


    // === ADVANCED OPERATIONS ===

    abstract render_text(text: string, options?: TextOrientedRendererOptionsType): Promise<Element>;
    abstract render_error(error: ErrorRendererValueType, options?: ErrorRendererOptionsType): Promise<Element>;
    abstract render_value(value: any, options?: TextOrientedRendererOptionsType): Promise<Element>;
    abstract println(text: string, options?: TextOrientedRendererOptionsType): Promise<Element>;
    abstract printf(format: string, ...args: any[]): Promise<Element>;
    abstract print__(options?: TextOrientedRendererOptionsType): Promise<Element>;
    abstract javascript(code: string, options?: TextOrientedRendererOptionsType): Promise<Element>;
    abstract markdown(code: string, options?: TextOrientedRendererOptionsType): Promise<Element>;
    abstract tex(code: string, options?: TextOrientedRendererOptionsType): Promise<Element>;
    abstract image_data(code: ImageDataRendererValueType, options?: ImageDataRendererOptionsType): Promise<Element>;
    abstract graphviz(code: GraphvizRendererValueType, options?: GraphvizRendererOptionsType): Promise<Element>;
    abstract plotly(code: PlotlyRendererValueType, options?: PlotlyRendererOptionsType): Promise<Element>;
    abstract canvas_image(canvas_renderer: CanvasImageRendererValueType, options?: CanvasImageRendererOptionsType): Promise<Element>;


    // === RENDERER INTERFACE ===

    abstract _invoke_renderer<ValueType, OptionsType>(
        renderer: { _render( ocx:      OutputContextLike,
                             value:    ValueType,
                             options?: OptionsType ): Promise<Element>,
                  },
        value:    ValueType,
        options?: OptionsType ): Promise<Element>;
}
