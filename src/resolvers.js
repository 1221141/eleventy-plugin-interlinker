import {EleventyRenderPlugin} from "@11ty/eleventy";
import {encodeHTML} from 'entities';

/**
 * Default Resolving function for converting Wikilinks into html links.
 *
 * @param {import('@photogabble/eleventy-plugin-interlinker').WikilinkMeta} link
 * @param {*} currentPage
 * @param {import('./interlinker')} interlinker
 * @return {Promise<string|undefined>}
 */
export const defaultResolvingFn = async (link, currentPage, interlinker) => {
  const text = encodeHTML(link.title ?? link.name);
  let href = link.href;

  if (link.anchor) {
    href = `${href}#${link.anchor}`;
  }

  if (href === false) {
    // If href is false, we don't want to create a link
    return link.link;
  } else if (href.startsWith(interlinker.opts.stubUrl)) {
    return `<span title="${text} was not created yet" class="dead-wikilink">${text}</span>`;
  } else {
    return `<a href="${href}" class="wikilink">${text}</a>`;
  }
}

/**
 * Default Resolving function for converting Wikilinks into Embeds.
 *
 * @param {import('@photogabble/eleventy-plugin-interlinker').WikilinkMeta} link
 * @param {*} currentPage
 * @param {import('./interlinker')} interlinker
 * @return {Promise<string|undefined>}
 */
export const defaultEmbedFn = async (link, currentPage, interlinker) => {
  if (!link.exists || !interlinker.templateConfig || !interlinker.extensionMap) return;

  const page = link.page;
  const template = await page.template.read();

  const layout = (page.data.hasOwnProperty(interlinker.opts.layoutKey))
    ? page.data[interlinker.opts.layoutKey]
    : interlinker.opts.defaultLayout;

  const language = (page.data.hasOwnProperty(interlinker.opts.layoutTemplateLangKey))
    ? page.data[interlinker.opts.layoutTemplateLangKey]
    : interlinker.opts.defaultLayoutLang === null
      ? page.page.templateSyntax
      : interlinker.opts.defaultLayoutLang;

  // TODO: (#36) the layout below is liquid, will break if content contains invalid template tags such as passing njk file src

  // This is the async compile function from the RenderPlugin.js bundled with 11ty. I'm using it directly here
  // to compile the embedded content.
  const compiler = EleventyRenderPlugin.String;

  // Compile template.content
  const contentFn = await compiler(template.content, language, {
    templateConfig: interlinker.templateConfig,
    extensionMap: interlinker.extensionMap
  });

  const content = await contentFn({...page.data});

  // If we don't have an embed layout wrapping this content, return the compiled result.
  if (layout === null) return content;

  // The template string is just to invoke the embed layout, the content value is the
  // compiled result of template.content.
  const tpl = `{% layout "${layout}" %}`

  const tplFn = await compiler(tpl, language, {
    templateConfig: interlinker.templateConfig,
    extensionMap: interlinker.extensionMap
  });

  return await tplFn({content, ...page.data});
}

/**
 * Default Resolving function for converting image wikilinks into img tags.
 *
 * @param {import('@photogabble/eleventy-plugin-interlinker').WikilinkMeta} link
 * @param {*} currentPage
 * @param {import('./interlinker')} interlinker
 * @return {Promise<string>}
 */
export const defaultImageEmbedFn = async (link, currentPage, interlinker) => {
  // If link.name already contains a path (like "images/photo.png"), use it as-is
  // Otherwise, prepend the imagesFolder
  const imagePath = link.name.includes('/') 
    ? `/${link.name}` 
    : `${interlinker.opts.imagesFolder || '/images/'}${link.name}`;
  
  // Extract filename for alt text (remove path and extension)
  const filename = link.name.split('/').pop().replace(/\.[^/.]+$/, "");
  const altText = encodeHTML(link.title || filename);
  
  return `<img src="${imagePath}" alt="${altText}" />`;
}