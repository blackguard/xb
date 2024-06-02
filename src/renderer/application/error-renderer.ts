import {
    ApplicationOrientedRenderer,
} from 'src/renderer/renderer';

import {
    ErrorRendererValueType,
    ErrorRendererOptionsType,
} from './types';

import {
    OutputContextLike,
} from 'src/output-context/types';


export class ErrorRenderer extends ApplicationOrientedRenderer<ErrorRendererValueType, ErrorRendererOptionsType> {
    get CLASS () { return this.constructor as typeof ErrorRenderer; }

    static get type (){ return 'error'; }

    static error_element_class      = 'error';
    static error_element_text_color = 'red';//!!! should be configurable

    /** Render the given error_object to ocx.
     * @param {OutputContextLike} ocx,
     * @param {Error|String} error_object,
     * @param {Object|undefined|null} options: {
     *     style?: Object,  // css style to be applied to output element
     * }
     * @return {Element} element to which output was rendered
     * @throws {Error} if error occurs
     */
    async _render(ocx: OutputContextLike, error_object: ErrorRendererValueType, options?: ErrorRendererOptionsType): Promise<Element> {
        return this.render_directly(ocx, error_object, options);
    }

    /** non-async; used internally to render errors without abort_if_stopped() checks
     */
    render_directly(ocx: OutputContextLike, error_object: ErrorRendererValueType, options?: ErrorRendererOptionsType): Element {
console.log(error_object);//!!! for debugging from console
        const style = options?.style;

        const text_segments = [];
        if (error_object instanceof Error) {
            text_segments.push(error_object.message ?? 'error');
            if (error_object.stack) {
                text_segments.push(error_object.stack);
            }
        } else {
            text_segments.push(error_object ?? 'error');
        }
        const text = text_segments.join('\n');

        const parent = ocx.create_child({
            tag: 'pre',
            attrs: {
                'data-type': this.type,
            },
            style: {
                ...(style ?? {}),
                color: this.CLASS.error_element_text_color,
            }
        }) as HTMLElement;
        parent.innerText = text;  // innerText sanitizes text

        return parent;
    }
}
