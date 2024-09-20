import {
    text_renderer_factory_for_type,
    reset_to_initial_text_renderer_factories,
    get_text_renderer_factories,
    set_text_renderer_factories,
    add_text_renderer_factory,
    remove_text_renderer_factory,
} from './factories';

import {
    TextBasedRendererOptionsType,
} from './text/types';

import {
    OutputContextLike,
} from 'src/output-context/types';


export interface RendererFactory {
    new (): Renderer;
    type: string;
};

export function is_RendererFactory(thing: any): boolean {
    // could be better...
    return (typeof thing === 'function' && typeof thing.type === 'string');
}


export class Renderer {
    /** type which instances handle, to be overridden in subclasses
     */
    static get type (){ return ''; }

    static get media_type (){ return `???/${this.type}`; }

    /** get the type specified by the class
     */
    get type (){ return (this.constructor as typeof Renderer).type; }

    /** get the media_type specified by the class
     */
    get media_type (){ return (this.constructor as typeof Renderer).media_type; }

    static async _invoke_renderer<ValueType, OptionsType>(
        renderer: { /*async*/ _render( ocx:      OutputContextLike,
                                       value:    ValueType,
                                       options?: OptionsType ): Promise<Element>,
                  },
        ocx:      OutputContextLike,
        value:    ValueType,
        options?: OptionsType ): Promise<Element>
    {
        return renderer._render(ocx, value, options)
            .catch((error: unknown) => {
                const result = ocx.render_error(error);
                try {
                    ocx.stop();  // stop anything that may have been started
                } catch (ignored_error: unknown) {
                    console.error('ignored second-level error while stopping ocx after render error', ignored_error);
                    // nothing
                }
                return result;
            });
    }
}


export abstract class TextBasedRenderer extends Renderer {
    static get media_type (){ return `text/${this.type}`; }

    static get_renderer_types():       string[] { return get_text_renderer_factories().map(rf => rf.type); }
    static reset_renderer_factories(): void     { reset_to_initial_text_renderer_factories(); }

    static factory_for_type(type: string):  undefined|RendererFactory { return text_renderer_factory_for_type(type); }
    static renderer_for_type(type: string): undefined|TextBasedRenderer {
        const factory = text_renderer_factory_for_type(type);
        if (!factory) {
            return undefined;
        } else {
            const renderer = new factory();
            return renderer as TextBasedRenderer;
        }
    }

    static get_renderer_factories():                                 RendererFactory[] { return get_text_renderer_factories(); }
    static set_renderer_factories(new_factories: RendererFactory[]): void              { set_text_renderer_factories(new_factories); }
    static add_renderer_factory(rf: RendererFactory):                void              { add_text_renderer_factory(rf); }

    static remove_renderer_factory(rf: RendererFactory):   void { remove_text_renderer_factory(rf); }
    static remove_renderer_factory_for_type(type: string): void {
        const factory = this.factory_for_type(type);
        if (factory) {
            this.remove_renderer_factory(factory);
        }
    }

    /** render the given value
     * @param {OutputContextLike} ocx,
     * @param {string} value,  // value to be rendered
     * @param {TextBasedRendererOptionsType|undefined} options,
     * @return {Element} element to which output was rendered
     * @throws {Error} if error occurs
     */
    async render(ocx: OutputContextLike, value: string, options?: TextBasedRendererOptionsType): Promise<Element> {
        return Renderer._invoke_renderer(this, ocx, value, options);
    }

    /** to be implemented by subclasses
     */
    abstract /*async*/ _render(ocx: OutputContextLike, value: string, options?: TextBasedRendererOptionsType): Promise<Element>;
}


export abstract class ApplicationBasedRenderer<ValueType, OptionsType> extends Renderer {
    static get media_type (){ return `application/${this.type}`; }

    /** render the given value
     * @param {OutputContextLike} ocx,
     * @param {ValueType} value,  // value appropriate to type (determined by subclass)
     * @param {OptionsType} options?: {
     *     style?:        Object,   // css style to be applied to output element
     *     inline?:       Boolean,  // render inline vs block?
     *     global_state?: Object,   // global_state for evaluation; default: ocx.xb.global_state using ocx passed to render()
     * }
     * @return {Element} element to which output was rendered
     * @throws {Error} if error occurs
     */
    async render(ocx: OutputContextLike, value: ValueType, options?: OptionsType): Promise<Element> {
        return Renderer._invoke_renderer(this, ocx, value, options);
    }

    /** to be implemented by subclasses
     */
    abstract /*async*/ _render(ocx: OutputContextLike, value: ValueType, options?: OptionsType): Promise<Element>;
}
