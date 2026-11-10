import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const script = await readFile(new URL("../public/js/carousel.js", import.meta.url), "utf8");
const dictionaries = Object.fromEntries(await Promise.all(["it", "en"].map(async (lang) =>
	[lang, JSON.parse(await readFile(new URL(`../locales/${lang}.json`, import.meta.url), "utf8"))]
)));

class Element {
	constructor() {
		this.attributes = {};
		this.events = {};
		this.children = [];
		this.textContent = "";
		this.hidden = true;
	}
	setAttribute(key, value) { this.attributes[key] = value; }
	removeAttribute(key) { delete this.attributes[key]; }
	addEventListener(event, handler) { this.events[event] = handler; }
	append(child) { this.children.push(child); }
	replaceChildren() { this.children = []; }
	emit(event, values = {}) { this.events[event]?.({ target: this, ...values }); }
}

function mount({ mobile = false, lang = "it", reducedMotion = false, hash = "" } = {}) {
	const dictionary = dictionaries[lang];
	const mobileQuery = { matches: mobile, addEventListener(event, handler) { this.change = handler; } };
	const track = new Element();
	track.id = "project-track";
	track.clientWidth = mobile ? 350 : 1050;
	track.scrollLeft = 0;
	track.scrollTo = (options) => {
		track.lastScroll = options;
		track.scrollLeft = options.left;
		track.emit("scroll");
	};
	const cards = Array.from({ length: 12 }, (_, index) => ({
		id: "project-" + ["vialenta", "tourpilot", "stockroom", "bridgebase", "margine", "quota", "skillario", "flotta", "gofood", "deskline", "mineralandia", "elica"][index],
		get offsetLeft() {
			const count = mobileQuery.matches ? 1 : 3;
			return index * ((track.clientWidth - 15 * (count - 1)) / count + 15);
		}
	}));
	track.querySelectorAll = () => cards;
	const controls = new Element();
	const pagination = new Element();
	const status = new Element();
	const previous = new Element();
	const next = new Element();
	const carousel = {
		dataset: { carouselRange: dictionary["projects.range"], carouselSingle: dictionary["projects.single"] },
		querySelector: (selector) => ({
			"[data-carousel-track]": track,
			"[data-carousel-controls]": controls,
			"[data-carousel-pages]": pagination,
			"[data-carousel-status]": status,
			"[data-carousel-prev]": previous,
			"[data-carousel-next]": next
		}[selector])
	};
	const timers = new Map();
	let timerId = 0;
	const windowEvents = {};
	const location = { hash };
	vm.runInNewContext(script, {
		document: { querySelector: () => carousel, createElement: () => new Element() },
		window: {
			location,
			matchMedia: (query) => query.includes("max-width") ? mobileQuery : { matches: reducedMotion },
			addEventListener: (event, handler) => { windowEvents[event] = handler; },
			setTimeout: (handler) => { timers.set(++timerId, handler); return timerId; },
			clearTimeout: (id) => timers.delete(id)
		}
	});
	const settle = () => {
		const callbacks = [...timers.values()];
		timers.clear();
		callbacks.forEach((handler) => handler());
	};
	return {
		track, cards, controls, pagination, status, previous, next, settle,
		navigateTo: (hash) => { location.hash = hash; windowEvents.hashchange(); },
		resize: (isMobile) => {
			mobileQuery.matches = isMobile;
			track.clientWidth = isMobile ? 350 : 1050;
			mobileQuery.change();
			windowEvents.resize();
		}
	};
}

for (const lang of ["it", "en"]) {
	for (const mobile of [false, true]) {
		test(`${lang}: ${mobile ? "one mobile card" : "three desktop cards"} per step, with boundaries`, () => {
			const dom = mount({ mobile, lang });
			const size = mobile ? 1 : 3;
			assert.equal(dom.pagination.children.length, 12 / size);
			assert.equal(dom.controls.hidden, false);
			assert.equal(dom.previous.disabled, true);
			assert.equal(dom.next.disabled, false);
			dom.next.emit("click");
			assert.equal(dom.track.scrollLeft, dom.cards[size].offsetLeft);
			assert.equal(dom.pagination.children[1].attributes["aria-current"], "true");
			assert.equal(dom.pagination.children[0].attributes["aria-current"], undefined);
			for (let index = 0; index < 15; index++) dom.next.emit("click");
			dom.settle();
			assert.equal(dom.track.scrollLeft, dom.cards[12 - size].offsetLeft);
			assert.equal(dom.next.disabled, true);
			assert.equal(dom.previous.disabled, false);
			assert.match(dom.status.textContent, /12/);
			for (let index = 0; index < 15; index++) dom.previous.emit("click");
			assert.equal(dom.track.scrollLeft, 0);
			assert.equal(dom.previous.disabled, true);
		});
	}
}

test("pagination and keyboard reach each group, including the last one", () => {
	const dom = mount();
	dom.pagination.children[2].emit("click");
	assert.equal(dom.track.scrollLeft, dom.cards[6].offsetLeft);
	assert.equal(dom.status.textContent, "Progetti 7–9 di 12");
	let prevented = false;
	dom.track.emit("keydown", { key: "End", preventDefault: () => { prevented = true; } });
	assert.equal(prevented, true);
	assert.equal(dom.track.scrollLeft, dom.cards[9].offsetLeft);
	dom.track.emit("keydown", { key: "ArrowLeft", preventDefault() {} });
	assert.equal(dom.track.scrollLeft, dom.cards[6].offsetLeft);
	dom.track.emit("keydown", { key: "Home", preventDefault() {} });
	assert.equal(dom.track.scrollLeft, 0);
});

test("touch and trackpad scrolling update the counter and buttons", () => {
	const dom = mount({ mobile: true, lang: "en" });
	dom.track.scrollLeft = dom.cards[4].offsetLeft;
	dom.track.emit("scroll");
	dom.settle();
	assert.equal(dom.status.textContent, "Project 5 of 12");
	dom.next.emit("click");
	assert.equal(dom.track.scrollLeft, dom.cards[5].offsetLeft);
});

test("resizing preserves the first visible project and regroups cards", () => {
	const dom = mount();
	dom.pagination.children[2].emit("click");
	dom.resize(true);
	assert.equal(dom.pagination.children.length, 12);
	assert.equal(dom.track.scrollLeft, dom.cards[6].offsetLeft);
	assert.equal(dom.status.textContent, "Progetto 7 di 12");
	dom.next.emit("click");
	dom.resize(false);
	assert.equal(dom.pagination.children.length, 4);
	assert.equal(dom.track.scrollLeft, dom.cards[6].offsetLeft);
	assert.equal(dom.status.textContent, "Progetti 7–9 di 12");
});

test("reduced motion preference skips smooth scrolling", () => {
	const dom = mount({ reducedMotion: true });
	dom.next.emit("click");
	assert.equal(dom.track.lastScroll.behavior, "instant");
	const animated = mount();
	animated.next.emit("click");
	assert.equal(animated.track.lastScroll.behavior, "smooth");
});

for (const mobile of [false, true]) {
	test(`direct links reveal the referenced project on ${mobile ? "mobile" : "desktop"}`, () => {
		const dom = mount({ mobile, hash: "#project-mineralandia" });
		assert.equal(dom.track.scrollLeft, dom.cards[mobile ? 10 : 9].offsetLeft);
		dom.navigateTo("#project-bridgebase");
		assert.equal(dom.track.scrollLeft, dom.cards[3].offsetLeft);
		dom.navigateTo("#contatti");
		assert.equal(dom.track.scrollLeft, dom.cards[3].offsetLeft);
	});
}
