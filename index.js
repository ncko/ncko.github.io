import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { parse, HTMLElement } from 'node-html-parser';
import Metalsmith from 'metalsmith';

const OUTPUT_FOLDER = './docs';
const SRC_FOLDER = './src';
const SITENAME = 'Nick Olsen';
const SITEURL = 'https://ncko.me/';
const DESCRIPTION = 'I write software';

function writeBuildID(options) {
    return (files) => {
        const path = options.path || './id';
        const decorator = options.decorator || function(id) { return id };
        const id = randomUUID();
        const file = {
            contents: Buffer.from(decorator(id)),
            mode: '0664'
        };

        files[path] = file;
    }
}

function addLiveJS(options) {
    const isEnabled = options && 'enable' in options ? options.enable : true;

    return (files, metalsmith) => {
        if (isEnabled) {
            metalsmith.match('**/*.html')
                .forEach(filepath => {
                    const scriptElement = new HTMLElement('script', {});
                    scriptElement.setAttribute('src', 'https://livejs.com/live.js')
                    const file = files[filepath];
                    const contents = file.contents.toString();
                    const root = parse(contents);

                    root.querySelector('head').appendChild(scriptElement);
                    file.contents = Buffer.from(root.toString());
                })
        }
    }
}

export const website = {
    build: function() {
        Metalsmith('./')
            .metadata({
                sitename: SITENAME,
                siteurl: SITEURL,
                description: DESCRIPTION
            })
            .source(SRC_FOLDER)
            .destination(OUTPUT_FOLDER)
            .clean(true)
            .use(writeBuildID({
                path: 'js/build-id.js',
                decorator: (id) => `const buildId = "${id}";`
            }))
            .use(addLiveJS({ enable: process.env.NODE_ENV === 'dev' }))
            .build(function(err) {
                if (err) throw err;
            });
    }
}

function isImport() {
    return process.argv[1] !== fileURLToPath(import.meta.url)
}

if (!isImport()) {
    website.build();
}

