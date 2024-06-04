import {
    OutputContextLike,
    StoppedError,
} from './types';

import {
    SerialDataSource,
} from 'lib/sys/serial-data-source';

import {
    ActivityManager,
} from 'lib/sys/activity-manager';

import {
    ErrorRenderer,
    ErrorRendererValueType,
    ErrorRendererOptionsType,
    ImageDataRenderer,
    ImageDataRendererValueType,
    ImageDataRendererOptionsType,
    GraphvizRenderer,
    GraphvizRendererValueType,
    GraphvizRendererOptionsType,
    PlotlyRenderer,
    PlotlyRendererValueType,
    PlotlyRendererOptionsType,
    CanvasImageRenderer,
    CanvasImageRendererValueType,
    CanvasImageRendererOptionsType,
    TextOrientedRenderer,
    TextOrientedRendererOptionsType,
    TextRenderer,
    MarkdownRenderer,
    TeXRenderer,
    JavaScriptRenderer,
} from 'src/renderer/_';


export class OutputContext extends OutputContextLike {
    // static utility methods are defined in OutputContextLike

    // get/set keepalive are defined in OutputContextLike

    // abort_if_stopped() and AIS() are defined in OutputContextLike

    // sprintf(), sleep(), delay_ms(), next_tick(), next_micro_tick() are defined in OutputContextLike

    readonly #parent:  undefined|OutputContext;
    readonly #element: Element;

    get parent  (){ return this.#parent; }
    get element (){ return this.#element; }

    /** construct a new OutputContext for the given element and with an optional parent.
     *  @param {Element} element controlled by this new OutputContext
     *  @param {undefined|OutputContext} parent for this new OutputContext
     *  @return {OutputContext}
     * If parent is given, then this new OutputContext will be added as a new
     * activity to parent.
     */
    constructor(element: Element, parent?: OutputContext) {
        super();
        if (!(element instanceof Element)) {
            throw new Error('element must be an instance of Element');
        }
        this.#parent = parent;
        this.#element = element;

        parent?.add_activity(this);
    }


    // === BASIC OPERATIONS ===

    /** remove all child elements and nodes of this.element via this.CLASS.clear_element()
     */
    clear(): void {
        this.abort_if_stopped();
        this.CLASS.clear_element(this.element);
    }

    /** scroll this.element into view via this.CLASS.scroll_element_into_view()
     */
    scroll_into_view(): void {
        this.abort_if_stopped();
        this.CLASS.scroll_element_into_view(this.element);
    }

    /** set attributes on an element which are taken from an object, via this.CLASS.set_element_attrs()
     */
    set_attrs(attrs: { [attr: string]: undefined|null|string }): void {
        this.abort_if_stopped();
        this.CLASS.set_element_attrs(this.element, attrs);
    }

    /** add/remove style properties on this.element via this.CLASS.update_element_style()
     * Throws an error if this.element is not an instance of HTMLElement.  //!!!
     */
    update_style(spec: { [prop: string]: undefined|null|string }): void {
        this.abort_if_stopped();
        if (! (this instanceof HTMLElement)) {
            throw new Error('this.element must be an instance of HTMLElement');
        }
        this.CLASS.update_element_style((this.element as HTMLElement), spec);
    }

    /** create a new child element of this.element via this.CLASS.create_element_child()
     *  See this.CLASS.create_element() for a description of options.
     *  @return {Element|object} the new child element or a mapping if return_mapping.
     */
    create_child_or_mapping(options?: object, return_mapping?: boolean): Element|object {
        this.abort_if_stopped();
        return this.CLASS.create_element_child_or_mapping(this.element, options, !!return_mapping);
    }

    /** create a new child element of this.element via this.CLASS.create_element_child()
     *  See this.CLASS.create_element() for a description of options.
     *  @return {Element|object} the new child element or a mapping if return_mapping.
     */
    create_child(options?: object): Element {
        this.abort_if_stopped();
        return this.CLASS.create_element_child(this.element, options);
    }

    /** create a new child element of this.element via this.CLASS.create_element_child_mapping() and return a mapping.
     *  See this.CLASS.create_element() for a description of options.
     *  @return {Element|object} the new child element or a mapping if return_mapping.
     */
    create_child_mapping(options?: object): object {
        this.abort_if_stopped();
        return this.create_child_or_mapping(options, true);
    }

    /** create a new OutputContextLike from the given element
     *  @param {Element} element the target element
     *  @param {undefined|OutputContextLike} parent
     *  @return {OutputContextLike} the new OutputContextLike object
     */
    create_new_ocx(element: Element, parent?: OutputContext): OutputContext {
        return new OutputContext(element, parent);
    }

    /** create a new OutputContext from a new child element of this.element created via this.create_child()
     *  @param {undefined|object} options to be passed to create_element()
     *  @return {OutputContext} the new child OutputContext
     * the new ocx will be managed by this ocx.
     */
    create_child_ocx(options?: object): OutputContext {
        this.abort_if_stopped();
        options ??= {};
        const parent_style_attr = this.element.getAttribute('style');
        if (parent_style_attr) {
            (options as any).attrs = {
                ...((options as any).attrs ?? {}),
                style: parent_style_attr,  // inherit parent's style attribute (vs style)
            };
        }
        const child_ocx = new OutputContext(this.create_child(options), this);
        return child_ocx;
    }


    // === ADVANCED OPERATIONS ===

    async render_text(text: string, options?: TextOrientedRendererOptionsType): Promise<Element> {
        this.abort_if_stopped();
        text ??= '';
        if (typeof text !== 'string') {
            text = (text as any)?.toString?.() ?? '';
        }
        return new TextRenderer().render(this, text, options);
    }

    async render_error(error: ErrorRendererValueType, options?: ErrorRendererOptionsType): Promise<Element> {
        // don't call this.abort_if_stopped() for render_error() so that errors can still be rendered
        // also, call the synchronous ErrorRenderer,render_sync() method.
        if (error instanceof StoppedError) {
            options = { ...(options ?? {}), abbreviated: true };
        }
        return ErrorRenderer.render_sync(this, error, options);
    }

    async render_value(value: any, options?: TextOrientedRendererOptionsType): Promise<Element> {
        this.abort_if_stopped();
        // transform value to text and then render as text
        let text: string;
        if (typeof value === 'undefined') {
            text = '[undefined]';
        } else if (typeof value?.toString === 'function') {
            text = value.toString();
        } else {
            text = '[unprintable value]';
        }
        return this.render_text(text, options);
    }

    async println(text: string, options?: TextOrientedRendererOptionsType): Promise<Element> {
        return this.render_text((text ?? '') + '\n', options);
    }

    async printf(format: string, ...args: any[]): Promise<Element> {
        let text: string;
        if (typeof format === 'undefined' || format === null) {
            text = '';
        } else {
            if (typeof format !== 'string' && typeof (format as any).toString === 'function') {
                format = (format as any).toString();
            }
            text = this.CLASS.sprintf(format, ...args);
        }
        return this.render_text(text)
    }

    async print__(options?: TextOrientedRendererOptionsType): Promise<Element> {
        this.abort_if_stopped();
        return this.create_child({ tag: 'hr' });
    }

    async javascript(code: string, options?: TextOrientedRendererOptionsType): Promise<Element> {
        this.abort_if_stopped();
        return new JavaScriptRenderer().render(this, code, options);
    }

    async markdown(code: string, options?: TextOrientedRendererOptionsType): Promise<Element> {
        this.abort_if_stopped();
        return new MarkdownRenderer().render(this, code, options);
    }

    async tex(code: string, options?: TextOrientedRendererOptionsType): Promise<Element> {
        this.abort_if_stopped();
        return new TeXRenderer().render(this, code, options);
    }

    async image_data(code: ImageDataRendererValueType, options?: ImageDataRendererOptionsType): Promise<Element> {
        this.abort_if_stopped();
        return new ImageDataRenderer().render(this, code, options);
    }

    async graphviz(code: GraphvizRendererValueType, options?: GraphvizRendererOptionsType): Promise<Element> {
        this.abort_if_stopped();
        return new GraphvizRenderer().render(this, code, options);
    }

    async plotly(code: PlotlyRendererValueType, options?: PlotlyRendererOptionsType): Promise<Element> {
        this.abort_if_stopped();
        return new PlotlyRenderer().render(this, code, options);
    }

    async canvas_image(canvas_renderer: CanvasImageRendererValueType, options?: CanvasImageRendererOptionsType): Promise<Element> {
        this.abort_if_stopped();
        return new CanvasImageRenderer().render(this, canvas_renderer, options);
    }


    // === RENDERER INTERFACE ===

    /** Run the given renderer with the given arguments in this ocx.
     *  This is intended only to be called by Renderer implementations.
     *  @param {Renderer} renderer instance
     *  @param {any} value
     *  @param {Object} options for renderer
     *  @return {any} return value from renderer
     */
    async _invoke_renderer<ValueType, OptionsType>(
        renderer: { _render( ocx:      OutputContextLike,
                             value:    ValueType,
                             options?: OptionsType ): Promise<Element>,
                  },
        value:    ValueType,
        options?: OptionsType ): Promise<Element>
    {
        return renderer._render(this, value, options)
            .catch((error: unknown) => {
                const result = ErrorRenderer.render_sync(this, error);
                try {
                    this.stop();  // stop anything that may have been started
                } catch (ignored_error: unknown) {
                    console.error('ignored second-level error while stopping ocx after render error', ignored_error);
                    // nothing
                }
                return result;
            });
    }
}
