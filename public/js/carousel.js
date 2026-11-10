(() => {
	const carousel = document.querySelector("[data-project-carousel]");
	if (!carousel) return;

	const track = carousel.querySelector("[data-carousel-track]");
	const cards = Array.from(track.querySelectorAll("[data-project]"));
	if (!cards.length) return;

	const controls = carousel.querySelector("[data-carousel-controls]");
	const pagination = carousel.querySelector("[data-carousel-pages]");
	const status = carousel.querySelector("[data-carousel-status]");
	const previous = carousel.querySelector("[data-carousel-prev]");
	const next = carousel.querySelector("[data-carousel-next]");
	const mobile = window.matchMedia("(max-width: 900px)");
	const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
	let perPage = mobile.matches ? 1 : 3;
	let page = 0;
	let width = -1;
	let scrollTimer;
	let dots = [];
	const pageCount = () => Math.ceil(cards.length / perPage);
	const offset = (index) => cards[index].offsetLeft - cards[0].offsetLeft;

	const describe = (index) => {
		const start = index * perPage + 1;
		const end = Math.min(start + perPage - 1, cards.length);
		const template = perPage === 1 ? carousel.dataset.carouselSingle : carousel.dataset.carouselRange;
		return template.replace("{start}", start).replace("{end}", end).replace("{total}", cards.length);
	};

	const updateControls = () => {
		previous.disabled = page === 0;
		next.disabled = page === pageCount() - 1;
		const description = describe(page);
		if (status.textContent !== description) status.textContent = description;
		dots.forEach((dot, index) => {
			if (index === page) dot.setAttribute("aria-current", "true");
			else dot.removeAttribute("aria-current");
		});
	};

	const goToPage = (index, animate = true) => {
		window.clearTimeout(scrollTimer);
		page = Math.max(0, Math.min(index, pageCount() - 1));
		track.scrollTo({
			left: offset(page * perPage),
			behavior: animate && !reducedMotion.matches ? "smooth" : "instant"
		});
		updateControls();
	};

	const syncLayout = () => {
		const size = mobile.matches ? 1 : 3;
		if (size === perPage && width === track.clientWidth) return;
		const firstVisibleCard = page * perPage;
		perPage = size;
		width = track.clientWidth;
		pagination.replaceChildren();
		dots = Array.from({ length: pageCount() }, (_, index) => {
			const button = document.createElement("button");
			button.type = "button";
			button.setAttribute("aria-label", describe(index));
			button.setAttribute("aria-controls", track.id);
			button.addEventListener("click", () => goToPage(index));
			pagination.append(button);
			return button;
		});
		goToPage(Math.floor(firstVisibleCard / perPage), false);
	};

	previous.addEventListener("click", () => goToPage(page - 1));
	next.addEventListener("click", () => goToPage(page + 1));
	track.addEventListener("keydown", (event) => {
		if (event.target !== track) return;
		const destinations = { ArrowLeft: page - 1, ArrowRight: page + 1, Home: 0, End: pageCount() - 1 };
		if (!Object.hasOwn(destinations, event.key)) return;
		event.preventDefault();
		goToPage(destinations[event.key]);
	});
	track.addEventListener("scroll", () => {
		window.clearTimeout(scrollTimer);
		scrollTimer = window.setTimeout(() => {
			const pageWidth = cards[perPage] ? offset(perPage) : track.clientWidth;
			page = Math.max(0, Math.min(Math.round(track.scrollLeft / pageWidth), pageCount() - 1));
			updateControls();
		}, 120);
	}, { passive: true });

	mobile.addEventListener("change", syncLayout);
	window.addEventListener("resize", syncLayout);
	const showLinkedProject = () => {
		const index = cards.findIndex((card) => card.id === window.location.hash.slice(1));
		if (index >= 0) goToPage(Math.floor(index / perPage), false);
	};
	window.addEventListener("hashchange", showLinkedProject);
	if (typeof ResizeObserver !== "undefined") new ResizeObserver(syncLayout).observe(track);
	syncLayout();
	showLinkedProject();
	controls.hidden = false;
})();
