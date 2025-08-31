import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { parse, HTMLElement } from 'node-html-parser';
import Metalsmith from 'metalsmith';
import markdown from '@metalsmith/markdown';
import layouts from '@metalsmith/layouts';
import handlebars from 'handlebars';
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
                
                // Extract title from first heading (skip if already has title)
                if (!file.title) {
                    const titleMatch = contents.match(/^##?\s+(.+)$/m);
                    file.title = titleMatch ? titleMatch[1] : 'Recipe';
                }
                
                if (!file.layout) {
                    file.layout = 'recipe.html';
                }
            })
    }
}

function addRecipeFiles() {
    return (files, metalsmith) => {
        const recipesDir = './recipes';
        const recipesList = [];
        
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
                    
                    // Extract recipe info for index
                    const contentStr = contents.toString();
                    const titleMatch = contentStr.match(/^##?\s+(.+)$/m);
                    const title = titleMatch ? titleMatch[1] : filename.replace('.md', '');
                    const slug = filename.replace('.md', '.html');
                    
                    recipesList.push({
                        title: title,
                        slug: slug,
                        filename: filename
                    });
                }
            });
        }
        
        // Store recipes list in metalsmith metadata for use in index template
        metalsmith._metadata.recipes = recipesList.sort((a, b) => a.title.localeCompare(b.title));
    }
}

function applyRecipeLayouts() {
    return (files, metalsmith) => {
        const layoutPath = 'src/layouts/recipe.html';
        if (!fs.existsSync(layoutPath)) {
            console.error('Recipe layout not found!');
            return;
        }

        const indexLayoutPath = 'src/layouts/recipe-index.html';
        if (!fs.existsSync(indexLayoutPath)) {
            console.error('Recipe index layout not found!');
            return;
        }
        
        const layoutTemplate = fs.readFileSync(layoutPath, 'utf8');
        const indexLayoutTemplate = fs.readFileSync(indexLayoutPath, 'utf8');
        const template = handlebars.compile(layoutTemplate);
        const indexTemplate = handlebars.compile(indexLayoutTemplate);
        
        Object.keys(files).forEach(filepath => {
            if (filepath.startsWith('recipes/') && filepath.endsWith('.html')) {
                const file = files[filepath];
                if (file.layout === 'recipe.html') {
                    const context = {
                        contents: file.contents.toString(),
                        title: file.title || 'Recipe',
                        ...metalsmith._metadata
                    };
                    
                    const rendered = template(context);
                    file.contents = Buffer.from(rendered);
                } else if (file.layout === 'recipe-index.html') {
                    const context = {
                        contents: file.contents.toString(),
                        title: file.title || 'Recipe',
                        ...metalsmith._metadata
                    };
                    
                    const rendered = indexTemplate(context);
                    file.contents = Buffer.from(rendered);
                }
            }
        });
    }
}

function createRecipesIndex() {
    return (files, metalsmith) => {
        const recipes = metalsmith._metadata.recipes || [];
        
        let indexContent = `# Recipes\n\n`;
        
        if (recipes.length === 0) {
            indexContent += `No recipes available yet.\n`;
        } else {
            recipes.forEach(recipe => {
                indexContent += `- [${recipe.title}](/recipes/${recipe.slug})\n`;
            });
        }
        
        files['recipes/index.md'] = {
            contents: Buffer.from(indexContent),
            mode: '0644',
            title: 'Recipes',
            layout: 'recipe-index.html'
        };
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
            .use(createRecipesIndex())
            .use(addRecipeMetadata())
            .use(markdown())
            .use(applyRecipeLayouts())
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

