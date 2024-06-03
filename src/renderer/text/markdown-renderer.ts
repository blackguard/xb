import {
    RendererFactory,
    TextOrientedRenderer,
} from 'src/renderer/renderer';

import {
    TextOrientedRendererOptionsType,
} from 'src/renderer/text/types';

import {
    _initial_text_renderer_factories,
} from 'src/renderer/factories';

import {
    TeXRenderer,
} from 'src/renderer/text/tex-renderer';

import {
    XbManager,
} from 'src/xb-manager';

import {
    marked,
} from './marked';

import {
    OutputContextLike,
} from 'src/output-context/types';

import {
    OpenPromise,
} from 'lib/sys/open-promise';

import {
    Activity,
} from 'lib/sys/activity-manager';


// TeX handling adapted from: marked-katex-extension/index.js
// https://github.com/UziTech/marked-katex-extension/blob/main/src/index.js
// See also: https://marked.js.org/using_pro#async

const extension_name__inline_tex = 'inline-tex';
const extension_name__block_tex  = 'block-tex';
const extension_name__eval_code  = 'eval-code';

type walkTokens_token_type = {
    type?:         string,
    raw?:          string,
    text?:         string,
    markup?:       string,
    global_state?: object,
    source_type?:  string,
};

export class MarkdownRenderer extends TextOrientedRenderer {
    static get type (){ return 'markdown'; }

    static {
        // required for all TextOrientedRenderer extensions
        _initial_text_renderer_factories.push(this);
    }

    /** Render by evaluating the given markdown and outputting to ocx.
     * @param {OutputContextLike} ocx,
     * @param {String} markdown,
     * @param {TextOrientedRendererOptionsType|undefined} options,
     * @return {Element} element to which output was rendered
     * @throws {Error} if error occurs
     */
    async _render(ocx: OutputContextLike, markdown: string, options?: TextOrientedRendererOptionsType): Promise<Element> {
        markdown ??= '';

        const {
            style,
            global_state = XbManager.singleton.global_state,
        } = (options ?? {});

        const parent = ocx.create_child({
            attrs: {
                'data-type': this.type,
            },
            style,
        });

        const main_renderer = this;  // used below in extensions code

        // sequencer_promise is used to evaluate the async walkTokens one
        // token at a time, in sequence.  Normally, marked runs the
        // async walkTokens on all tokens in concurrently.
        // This is important because our renderers may be stateful.
        let sequencer_promise: undefined|OpenPromise<void> = undefined;;

        const marked_options = {
            async: true,  // needed to tell the marked parser operate asynchronously, and to return a promise
            async walkTokens(token: walkTokens_token_type) {
                const prior_sequencer_promise = sequencer_promise;
                const new_sequencer_promise = new OpenPromise<void>();
                sequencer_promise = new_sequencer_promise;
                if (prior_sequencer_promise) {
                    await prior_sequencer_promise.await();
                }

                switch (token.type) {
                case extension_name__inline_tex:
                case extension_name__block_tex: {
                    token.global_state = global_state;
                    break;
                }

                case extension_name__eval_code: {
                    const output_element = document.createElement('div');
                    const sub_ocx = ocx.create_new_ocx(output_element, ocx);
                    let renderer_factory: undefined|RendererFactory = undefined;
                    try {
                        const source_type = token.source_type;
                        if (!source_type) {
                            throw new Error('no source_type present');
                        }
                        renderer_factory = TextOrientedRenderer.factory_for_type(source_type);
                    } catch (error: unknown) {
                        await sub_ocx.render_error(error);
                    }
                    if (renderer_factory) {  // i.e., no error
                        const renderer_options = {
                            global_state,
                        };
                        const renderer: TextOrientedRenderer = new renderer_factory() as TextOrientedRenderer;
                        await renderer.render(sub_ocx, token.text ?? '', renderer_options)
                            .catch((error: unknown) => sub_ocx.render_error(error));

                        sub_ocx.stop();  // stop background processing, if any
                    }
                    token.markup = output_element.innerHTML;
                    break;
                }
                }

                new_sequencer_promise.resolve();  // permit next token to be processed
            }
        };

        const markup = await marked.parse(markdown, marked_options);  // using extensions, see below
        parent.innerHTML = markup;

        return parent;
    }
}

marked.use({
    extensions: [
        {
            name: extension_name__inline_tex,
            level: 'inline',
            start(src: string) { return src.indexOf('$'); },
            tokenizer(src: string, tokens: unknown): undefined|walkTokens_token_type {
                const match = src.match(/^\$+([^$]+?)\$+/);
                if (!match) {
                    return undefined;
                } else {
                    return {
                        type: extension_name__inline_tex,
                        raw:  match[0],
                        text: match[1].trim(),
                        global_state: undefined,  // filled in later by walkTokens
                    };
                }
            },
            renderer(token: walkTokens_token_type) {
                return TeXRenderer.render_to_string(token.text ?? '', token.global_state, {
                    displayMode:  false,
                    throwOnError: false,
                });
            },
        },
        {
            name: extension_name__block_tex,
            level: 'block',
            start(src: string) { return src.indexOf('$$'); },
            tokenizer(src: string, tokens: unknown): undefined|walkTokens_token_type {
                const match = src.match(/^\$\$([^$]+?)\$\$/);
                if (!match) {
                    return undefined;
                } else {
                    return {
                        type: extension_name__block_tex,
                        raw:  match[0],
                        text: match[1].trim(),
                        global_state: undefined,  // filled in later by walkTokens
                    };
                }
            },
            renderer(token: walkTokens_token_type) {
                const markup = TeXRenderer.render_to_string(token.text ?? '', token.global_state, {
                    displayMode:  true,
                    throwOnError: false,
                });
                return `<p>${markup}</p>`;
            },
        },
        {
            name: extension_name__eval_code,
            level: 'block',
            start(src: string) { return src.match(/^[`]{3}[ ]*[!]/)?.index; },
            tokenizer(src: string, tokens: unknown): undefined|walkTokens_token_type {
                const match = src.match(/^[`]{3}[ ]*[!]([ \t]*[^\n]*[ \t]*)?[\n](.*?)[`]{3}/s);
                if (!match) {
                    return undefined;
                } else {
                    const source_type = (match[1]?.trim() ?? '') || 'javascript';
                    return {
                        type: extension_name__eval_code,
                        source_type,
                        raw:  match[0],
                        text: match[2],
                        markup: undefined,  // filled in later by walkTokens
                    };
                }
            },
            renderer(token: walkTokens_token_type) {
                return token.markup;
            },
        },
    ],
});
