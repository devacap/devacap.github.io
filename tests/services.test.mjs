import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const decode = (value) => value.replace(/&(amp|lt|gt|quot|#39);/g, (_, key) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[key]));
const attributes = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, decode(value)]));
const areas = ["management", "integrations", "commerce", "operations", "data", "platforms"];

for (const [lang, filename, alternate] of [["it", "servizi.html", "en/services.html"], ["en", "en/services.html", "servizi.html"]]) {
	const html = await readFile(path.join(root, filename), "utf8");
	const dictionary = JSON.parse(await readFile(path.join(root, `locales/${lang}.json`), "utf8"));
	const base = new URL(filename, "https://preview.test/");

	test(`${filename}: translated services, metadata and active navigation`, () => {
		assert.match(html, new RegExp(`<html lang="${lang}">`));
		assert.doesNotMatch(html, /{{\s*[\w.]+\s*}}/);
		assert.equal((html.match(/<h1\b/g) || []).length, 1);
		assert.equal((html.match(/class="service-row"/g) || []).length, 6);
		for (const area of areas) {
			assert.ok(decode(html).includes(dictionary[`services.${area}.title`]));
			assert.ok(decode(html).includes(dictionary[`services.${area}.intro`]));
		}
		assert.ok(decode(html).includes(dictionary["services.existing.intro"]));
		assert.ok(decode(html).includes(dictionary["services.method.thirdBody"]));
		assert.ok(decode(html).includes(`<title>${dictionary["services.meta.title"]}</title>`));
		assert.equal(attributes(html.match(/<link rel="canonical"[^>]*>/)[0]).href, `https://devacap.github.io/${filename}`);
		const selected = html.match(/<a\b[^>]*aria-current="page"[^>]*>/g);
		assert.equal(selected.length, 1);
		assert.equal(attributes(selected[0]).href, lang === "it" ? "servizi.html" : "services.html");
	});

	test(`${filename}: navigation resolves, with a portfolio link and no individual project references`, async () => {
		const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(([, id]) => id);
		assert.equal(new Set(ids).size, ids.length);
		for (const [, value] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
			const target = new URL(decode(value), base);
			if (target.origin !== base.origin) continue;
			const relative = decodeURIComponent(target.pathname).replace(/^\//, "") || "index.html";
			const targetPath = path.join(root, relative.endsWith("/") ? relative + "index.html" : relative);
			assert.ok((await stat(targetPath)).isFile(), value);
			if (target.hash) {
				const destination = await readFile(targetPath, "utf8");
				assert.ok(destination.includes(`id="${target.hash.slice(1)}"`), value);
			}
		}
		const content = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)[1];
		assert.doesNotMatch(content, /service-evidence|href="[^"]*#project-/);
		assert.ok(content.includes(`href="./#progetti">${dictionary["services.hero.projects"]}`));
		assert.doesNotMatch(content, /Vialenta|TourPilot|Stockroom|BridgeBase|Margine|Quota|Skillario|Flotta|GoFood|Deskline|Mineralandia|Elica|GetYourGuide|Viator|TourCMS|PrestaShop|Shopify|WooCommerce|\bECM\b/);
	});

	test(`${filename}: changing language keeps the visitor on the services page`, () => {
		const language = attributes(html.match(/<a\b[^>]*data-language-link[^>]*>/)[0]);
		assert.equal(new URL(language.href, base).pathname, "/" + alternate);
		assert.equal(language.lang, lang === "it" ? "en" : "it");
		const alternates = [...html.matchAll(/<link rel="alternate"[^>]*>/g)].map(([tag]) => attributes(tag));
		assert.deepEqual(alternates.map((link) => [link.hreflang, link.href]), [
			["it", "https://devacap.github.io/servizi.html"],
			["en", "https://devacap.github.io/en/services.html"],
			["x-default", "https://devacap.github.io/servizi.html"]
		]);
	});

	test(`${filename}: contact form and privacy text use the page language`, () => {
		assert.equal((html.match(/<form\b/g) || []).length, 1);
		const form = attributes(html.match(/<form\b[^>]*>/)[0]);
		assert.equal(form.action, "https://api.web3forms.com/submit");
		assert.equal(form["data-message-success"], dictionary["form.success"]);
		assert.equal(form["data-message-error"], dictionary["form.error"]);
		assert.ok(decode(html).includes(dictionary["privacy.summary"]));
		assert.ok(decode(html).includes(dictionary["form.messagePlaceholder"]));
	});

	test(`${filename}: the portfolio links to services in the matching language`, async () => {
		const home = await readFile(path.join(root, lang === "it" ? "index.html" : "en/index.html"), "utf8");
		assert.ok(home.includes(`href="${lang === "it" ? "servizi.html" : "services.html"}">${dictionary["nav.services"]}</a>`));
	});
}
