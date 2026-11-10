import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
if (args.length && (args[0] !== "--site-url" || args.length !== 2)) {
	throw new Error("Usage: node scripts/build.mjs [--site-url https://example.com/]");
}

// The default corresponds to this repository's GitHub Pages address.
const siteUrl = new URL(args[1] || "https://devacap.github.io/");
if (!["https:", "http:"].includes(siteUrl.protocol) || siteUrl.search || siteUrl.hash || siteUrl.username || siteUrl.password) {
	throw new Error("The site URL must be an HTTP(S) URL without a query, fragment or credentials.");
}
siteUrl.pathname = `${siteUrl.pathname.replace(/\/$/, "")}/`;

const partials = Object.fromEntries(await Promise.all(["head", "header", "contact", "footer"].map(async (name) =>
	[name, await readFile(path.join(root, `templates/partials/${name}.html`), "utf8")]
)));
const definitions = [
	{ name: "home", routes: { it: "", en: "en/" } },
	{ name: "services", routes: { it: "servizi.html", en: "en/services.html" } }
];
const templates = Object.fromEntries(await Promise.all(definitions.map(async ({ name }) => {
	const template = await readFile(path.join(root, `templates/${name === "home" ? "index" : name}.html`), "utf8");
	return [name, template.replace(/{{\s*(head|header|contact|footer)\s*}}/g, (_, key) => partials[key])];
})));
const languages = ["it", "en"];
const dictionaries = await Promise.all(languages.map(async (lang) =>
	JSON.parse(await readFile(path.join(root, `locales/${lang}.json`), "utf8"))
));
const expectedKeys = Object.keys(dictionaries[0]).sort();
for (const [index, dictionary] of dictionaries.entries()) {
	if (JSON.stringify(Object.keys(dictionary).sort()) !== JSON.stringify(expectedKeys)) {
		throw new Error(`Translation keys differ for ${languages[index]}.`);
	}
	for (const [key, value] of Object.entries(dictionary)) {
		if (typeof value !== "string" || !value.trim()) {
			throw new Error(`Empty or invalid translation: ${languages[index]}.${key}`);
		}
	}
}

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
	"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[character]));

// Render every language before writing, so a missing translation fails the build.
const pages = definitions.flatMap((definition) => languages.map((lang, index) => {
	const isItalian = lang === "it";
	const isHome = definition.name === "home";
	const route = definition.routes[lang];
	const filename = !route || route.endsWith("/") ? `${route}index.html` : route;
	const alternateRoute = definition.routes[isItalian ? "en" : "it"];
	let alternateUrl = path.posix.relative(path.posix.dirname(filename), alternateRoute || ".") || ".";
	if (!alternateRoute || alternateRoute.endsWith("/")) alternateUrl += "/";
	const assetPrefix = isItalian ? "" : "../";
	const values = {
		...dictionaries[index],
		lang,
		assetPrefix,
		homeUrl: isHome ? "" : "./",
		servicesUrl: isItalian ? "servizi.html" : "services.html",
		pageTitle: isHome ? "Matteo Cappelli" : dictionaries[index]["services.meta.title"],
		pageDescription: dictionaries[index][isHome ? "meta.description" : "services.meta.description"],
		alternateUrl,
		alternateLang: isItalian ? "en" : "it",
		alternateLabel: isItalian ? "English" : "Italiano",
		alternateFlag: isItalian ? "flag-gb.svg" : "flag-it.svg"
	};
	const raw = {
		servicesCurrent: isHome ? "" : ' aria-current="page"',
		pageScripts: isHome ? `<script src="${assetPrefix}public/js/carousel.js" defer></script>` : "",
		pageStyles: isHome ? "" : `<link rel="stylesheet" href="${assetPrefix}public/css/services.css" />`,
		seoLinks: [
			`<link rel="canonical" href="${escapeHtml(new URL(route || "./", siteUrl).href)}" />`,
			`<link rel="alternate" hreflang="it" href="${escapeHtml(new URL(definition.routes.it || "./", siteUrl).href)}" />`,
			`<link rel="alternate" hreflang="en" href="${escapeHtml(new URL(definition.routes.en, siteUrl).href)}" />`,
			`<link rel="alternate" hreflang="x-default" href="${escapeHtml(new URL(definition.routes.it || "./", siteUrl).href)}" />`
		].join("\n\t")
	};
	const html = templates[definition.name].replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => {
		if (Object.hasOwn(raw, key)) return raw[key];
		if (!Object.hasOwn(values, key)) throw new Error(`Missing template value: ${lang}.${key}`);
		return escapeHtml(values[key]);
	}).replace(/[\t ]+$/gm, "");
	return { filename, html };
}));

await mkdir(path.join(root, "en"), { recursive: true });
for (const { filename, html } of pages) {
	await writeFile(path.join(root, filename), html);
	console.log(`Generated ${filename}`);
}
