import {
    TextOrientedRenderer,
} from 'src/renderer/renderer';

import {
    _initial_text_renderer_factories,
} from 'src/renderer/factories';

import {
    TextOrientedRendererOptionsType,
} from 'src/renderer/text/types';

import {
    OutputContextLike,
} from 'src/output-context/types';

import {
    XbManager,
} from 'src/xb-manager';

import {
    katex,
} from './katex/_';


export class TeXRenderer extends TextOrientedRenderer {
    get CLASS () { return this.constructor as typeof TeXRenderer; }

    static get type (){ return 'tex'; }

    static {
        // required for all TextOrientedRenderer extensions
        _initial_text_renderer_factories.push(this);
    }

    /** Render the given TeX source to ocx.
     * @param {OutputContextLike} ocx,
     * @param {String} tex,
     * @param {TextOrientedRendererOptionsType|undefined} options,
     * @return {Element} element to which output was rendered
     * @throws {Error} if error occurs
     */
    async _render(ocx: OutputContextLike, tex: string, options?: TextOrientedRendererOptionsType): Promise<Element> {
        tex ??= '';

        const {
            style,
            global_state = XbManager.singleton.global_state,
        } = (options ?? {});

        const markup = this.CLASS.render_to_string(tex, global_state, {
            displayMode:  true,
            throwOnError: false,
        });

        const parent = ocx.create_child({
            attrs: {
                'data-type': this.type,
            },
            style,
        });
        parent.innerHTML = markup;

        return parent;
    }

    static render_to_string(tex: string, global_state: any, katex_options?: object): string {
        // this function encapsulates how the "macros" options is gotten from global_state
        katex_options ??= {};
        (katex_options as any).macros ??= (global_state[this.type] ??= {});  // for persistent \gdef macros
        return katex.renderToString(tex, katex_options);
    }
}
