import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { parse, HTMLElement } from 'node-html-parser';
import Metalsmith from 'metalsmith';
import markdown from '@metalsmith/markdown';
import layouts from '@metalsmith/layouts';
import fs from 'fs';
import path from 'path';

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

                    // root.querySelector('head').appendChild(scriptElement);
                    file.contents = Buffer.from(root.toString());
                })
        }
    }
}

function addRecipeMetadata() {
    return (files, metalsmith) => {
        metalsmith.match('recipes/**/*.md')
            .forEach(filepath => {
                const file = files[filepath];
                const contents = file.contents.toString();
                
                // Extract title from first heading
                const titleMatch = contents.match(/^##?\s+(.+)$/m);
                const title = titleMatch ? titleMatch[1] : 'Recipe';
                
                file.title = title;
                file.layout = 'recipe.html';
            })
    }
}

function addRecipeFiles() {
    return (files, metalsmith) => {
        const recipesDir = './recipes';
        
        if (fs.existsSync(recipesDir)) {
            const recipeFiles = fs.readdirSync(recipesDir);
            recipeFiles.forEach(filename => {
                if (filename.endsWith('.md')) {
                    const filepath = path.join(recipesDir, filename);
                    const contents = fs.readFileSync(filepath);
                    const key = `recipes/${filename}`;
                    files[key] = {
                        contents: contents,
                        mode: '0644'
                    };
                }
            });
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
            .use(addRecipeFiles())
            .use(addRecipeMetadata())
            .use(markdown())
            .use(layouts({
                directory: 'src/layouts',
                default: 'recipe.html',
                pattern: 'recipes/**/*.html',
                transform: 'jstransformer-marked'

            }))
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

