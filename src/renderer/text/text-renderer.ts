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


export class TextRenderer extends TextOrientedRenderer {
    static get type (){ return 'plain'; }

    static {
        // required for all TextOrientedRenderer extensions
        _initial_text_renderer_factories.push(this);
    }

    async _render(ocx: OutputContextLike, text: string, options?: TextOrientedRendererOptionsType): Promise<Element> {
        const {
            style,
            inline,
        } = (options ?? {});

        const span = ocx.create_child({
            tag: 'span',
            attrs: {
                'data-source-media-type': this.media_type,
                class: 'plain-text',  // see 'src/style.css'
            },
            style,
        }) as HTMLElement;
        span.innerText = text;  // innerText sanitizes text
        return span;
    }
}
