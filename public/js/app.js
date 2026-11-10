document.documentElement.classList.add("js");

const header = document.querySelector("[data-header]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const navigation = document.querySelector("[data-nav]");
const year = document.querySelector("[data-year]");

year.textContent = new Date().getFullYear();

const updateHeader = () => {
	header.classList.toggle("is-scrolled", window.scrollY > 24);
};

updateHeader();
window.addEventListener("scroll", updateHeader, { passive: true });

window.addEventListener("load", () => {
	const target = window.location.hash
		? document.getElementById(window.location.hash.slice(1))
		: null;

	if (target) {
		document.documentElement.style.scrollBehavior = "auto";
		target.scrollIntoView();
		document.documentElement.style.scrollBehavior = "";
	}
});

// Keep the current section when following a language link. The links also work
// without JavaScript, and relative URLs support local previews and subdirectories.
const languageLinks = document.querySelectorAll("[data-language-link]");
const updateLanguageLinks = () => {
	languageLinks.forEach((link) => {
		const url = new URL(link.href, window.location.href);
		url.hash = window.location.hash;
		link.href = url.href;
	});
};
updateLanguageLinks();
window.addEventListener("hashchange", updateLanguageLinks);

menuToggle.addEventListener("click", () => {
	const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
	menuToggle.setAttribute("aria-expanded", String(!isOpen));
	navigation.classList.toggle("is-open", !isOpen);
});

navigation.querySelectorAll("a").forEach((link) => {
	link.addEventListener("click", () => {
		menuToggle.setAttribute("aria-expanded", "false");
		navigation.classList.remove("is-open");
	});
});

const contactForm = document.querySelector("[data-contact-form]");
const formStatus = document.querySelector("[data-form-status]");
const messages = contactForm.dataset;

contactForm.addEventListener("submit", async (event) => {
	event.preventDefault();

	if (!contactForm.checkValidity()) {
		contactForm.reportValidity();
		formStatus.textContent = messages.messageRequired;
		return;
	}

	formStatus.textContent = messages.messageSending;

	try {
		const response = await fetch(contactForm.action, {
			method: "POST",
			body: new FormData(contactForm),
			headers: {
				'Accept': 'application/json'
			}
		});

		const json = await response.json();

		if (response.ok && json.success) {
			formStatus.textContent = messages.messageSuccess;
			contactForm.reset();
		} else {
			formStatus.textContent = messages.messageError;
		}
	} catch (error) {
		formStatus.textContent = messages.messageNetwork;
	}
});
