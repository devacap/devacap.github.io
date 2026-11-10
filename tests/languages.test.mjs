import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = fileURLToPath(new URL("../", import.meta.url));
const app = await readFile(path.join(root, "public/js/app.js"), "utf8");
const decode = (value) => value.replace(/&(amp|lt|gt|quot|#39);/g, (_, entity) => ({
	amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'"
}[entity]));
const attributes = (tag) => Object.fromEntries(
	[...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, decode(value)])
);
const pages = await Promise.all(["it", "en"].map(async (lang) => ({
	lang,
	filename: lang === "it" ? "index.html" : "en/index.html",
	html: await readFile(path.join(root, lang === "it" ? "index.html" : "en/index.html"), "utf8"),
	dictionary: JSON.parse(await readFile(path.join(root, `locales/${lang}.json`), "utf8"))
})));

for (const page of pages) {
	test(`${page.lang}: static content, language metadata, assets and anchors`, async () => {
		assert.match(page.html, new RegExp(`<html lang="${page.lang}">`));
		assert.doesNotMatch(page.html, /{{\s*[\w.]+\s*}}/);
		assert.equal((page.html.match(/class="micro-card[ "]/g) || []).length, 12);
		const ids = [...page.html.matchAll(/\sid="([^"]+)"/g)].map(([, id]) => id);
		assert.equal(new Set(ids).size, ids.length, "IDs must be unique");
		assert.ok(decode(page.html).includes(page.dictionary["hero.intro"]));
		assert.ok(decode(page.html).includes(page.dictionary["privacy.summary"]));
		assert.ok(decode(page.html).includes(page.dictionary["elica.contribution"]));

		const canonical = attributes(page.html.match(/<link rel="canonical"[^>]*>/)[0]);
		assert.equal(canonical.href, `https://devacap.github.io/${page.lang === "it" ? "" : "en/"}`);
		const alternates = [...page.html.matchAll(/<link rel="alternate"[^>]*>/g)].map(([tag]) => attributes(tag));
		assert.deepEqual(alternates.map((link) => [link.hreflang, link.href]), [
			["it", "https://devacap.github.io/"],
			["en", "https://devacap.github.io/en/"],
			["x-default", "https://devacap.github.io/"]
		]);

		for (const [, target] of page.html.matchAll(/(?:href|src)="([^"]+)"/g)) {
			if (target.startsWith("#")) {
				assert.ok(ids.includes(target.slice(1)), `Missing anchor ${target}`);
			} else if (!/^https?:/.test(target)) {
				const resolved = path.resolve(root, path.dirname(page.filename), decode(target));
				const file = await stat(resolved);
				if (file.isDirectory()) await stat(path.join(resolved, "index.html"));
			}
		}
		const switches = [...page.html.matchAll(/<a\b[^>]*data-language-link[^>]*>/g)].map(([tag]) => attributes(tag));
		assert.equal(switches.length, 1);
		assert.equal(switches[0].lang, page.lang === "it" ? "en" : "it");
		assert.equal(switches[0]["aria-label"], page.lang === "it" ? "English" : "Italiano");
	});

	test(`${page.lang}: carousel restores every complete card in its original order`, () => {
		const cards = [...page.html.matchAll(/<article\b[^>]*data-project="([^"]+)"[^>]*>([\s\S]*?)<\/article>/g)];
		const expectedProjects = ["vialenta", "tourpilot", "stockroom", "bridgebase", "margine", "quota", "skillario", "flotta", "gofood", "deskline", "mineralandia", "elica"];
		assert.deepEqual(cards.map(([, key]) => key), expectedProjects);
		for (const [, key, content] of cards) {
			assert.ok(decode(content).includes(page.dictionary[`${key}.description`]), `${key} description`);
			assert.ok(decode(content).includes(page.dictionary[`${key}.contribution`]), `${key} contribution`);
			assert.match(content, /<ul\b[^>]*>[\s\S]*?<li>/, `${key} technologies`);
			assert.match(content, /<img\b/, `${key} image`);
		}
		assert.doesNotMatch(page.html, /featured-projects|project-archive|class="project-item"/);
		assert.ok(page.html.includes(page.dictionary["projects.previous"]));
		assert.ok(page.html.includes(page.dictionary["projects.next"]));
		assert.match(page.html, /id="project-track"[^>]*tabindex="0"/);
		assert.match(page.html, /data-carousel-controls hidden/);
	});
}

// A small DOM fixture exercises the shared script using the generated page's
// real language links and form messages, with a simulated submission service.
function mount(page, { valid = true, fetchResult = "success", hash = "#progetti" } = {}) {
	const listeners = {};
	const submit = {};
	const status = { textContent: "" };
	const classes = { add() {}, remove() {}, toggle() {} };
	const element = { classList: classes, addEventListener() {} };
	const menu = { ...element, getAttribute: () => "false", setAttribute() {} };
	const navigation = { ...element, querySelectorAll: () => [] };
	const formTag = page.html.match(/<form\b[^>]*>/)[0];
	const formAttributes = attributes(formTag);
	const dataset = Object.fromEntries(Object.entries(formAttributes)
		.filter(([key]) => key.startsWith("data-message-"))
		.map(([key, value]) => [key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), value]));
	let fetches = 0;
	let resets = 0;
	let validityReports = 0;
	const form = {
		action: formAttributes.action,
		dataset,
		checkValidity: () => valid,
		reportValidity: () => { validityReports++; },
		reset: () => { resets++; },
		addEventListener: (event, handler) => { submit[event] = handler; }
	};
	const base = `http://localhost/portfolio/${page.lang === "it" ? "" : "en/"}`;
	const location = { href: base + hash, hash };
	const links = [...page.html.matchAll(/<a\b[^>]*data-language-link[^>]*>/g)]
		.map(([tag]) => ({ href: new URL(attributes(tag).href, base).href }));
	const elements = {
		"[data-header]": element,
		"[data-menu-toggle]": menu,
		"[data-nav]": navigation,
		"[data-year]": { textContent: "" },
		"[data-contact-form]": form,
		"[data-form-status]": status
	};
	vm.runInNewContext(app, {
		document: {
			documentElement: { classList: classes, style: {} },
			querySelector: (selector) => elements[selector],
			querySelectorAll: () => links,
			getElementById: () => null
		},
		window: { location, scrollY: 0, addEventListener: (event, handler) => { listeners[event] = handler; } },
		URL,
		FormData: class {},
		fetch: async () => {
			fetches++;
			assert.equal(status.textContent, page.dictionary["form.sending"]);
			if (fetchResult === "network") throw new Error("Offline");
			return {
				ok: fetchResult !== "error",
				json: async () => ({ success: fetchResult === "success", message: "Untranslated server message" })
			};
		}
	});
	return {
		links, location, listeners, status,
		submit: () => submit.submit({ preventDefault() {} }),
		fetches: () => fetches,
		resets: () => resets,
		validityReports: () => validityReports
	};
}

for (const page of pages) {
	test(`${page.lang}: language links preserve the section under a subdirectory`, () => {
		const dom = mount(page);
		assert.equal(dom.links.length, 1);
		assert.equal(dom.links[0].href, page.lang === "it"
			? "http://localhost/portfolio/en/#progetti"
			: "http://localhost/portfolio/#progetti");
		dom.location.hash = "#contatti";
		dom.listeners.hashchange();
		assert.ok(dom.links.every((link) => link.href.endsWith("#contatti")));
		dom.location.hash = "";
		dom.listeners.hashchange();
		assert.ok(dom.links.every((link) => !link.href.includes("#")));
	});

	test(`${page.lang}: validation message without submitting an invalid form`, async () => {
		const dom = mount(page, { valid: false });
		await dom.submit();
		assert.equal(dom.status.textContent, page.dictionary["form.required"]);
		assert.equal(dom.fetches(), 0);
		assert.equal(dom.validityReports(), 1);
	});

	for (const [fetchResult, message] of [["success", "form.success"], ["error", "form.error"], ["network", "form.network"]]) {
		test(`${page.lang}: translated ${fetchResult} submission message`, async () => {
			const dom = mount(page, { fetchResult });
			await dom.submit();
			assert.equal(dom.status.textContent, page.dictionary[message]);
			assert.equal(dom.resets(), fetchResult === "success" ? 1 : 0);
		});
	}
}
