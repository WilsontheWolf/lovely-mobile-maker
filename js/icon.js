import { zip_open, zip_read_file, entry_names, write_file, zip_save_and_sign_v2 } from "./pkg/mbf_bindgen.js";
import { urlToImg, convertBinaryToDataURI, imgToURLOfSize } from "./img.js";

const uploadIcon = {
    type: "upload",
    name: "Custom",
};

const icons = [
    {
	type: "internal",
	name: "Default",
    },
    {
	type: "external",
	name: "Balatro",
	src: "/img/Balatro.png",
	round: true,
    },
    {
	type: "external",
	name: "LÖVE",
	src: "/img/love.png",
    },
    uploadIcon,
];

let customIcon = null;
let customIconDiv = null;
let lastStep;

const highest = "xxxhdpi";
const qualities = [
    ["mdpi", 48],
    ["hdpi", 72],
    ["xhdpi", 96],
    ["xxhdpi", 144],
    ["xxxhdpi", 192],
];
const customForm = {
    upload: document.getElementById("icon-upload"),
    crop: document.getElementById("icon-crop"),
    round: document.getElementById("icon-round"),
};

let highestPx = qualities.find(i => i[0] === highest)[1];

const setup = {
    internal: (conf, sharedState) => {
	const iconBuffer = zip_read_file(sharedState.apk, `res/drawable-${highest}-v4/love.png`);
	return urlToImg(convertBinaryToDataURI(iconBuffer, "image/png"));
    },
    external: async (conf) => {
	let img = await urlToImg(conf.src);
	if (conf.round || conf.zoom) {
	    img = urlToImg(imgToURLOfSize(img, highestPx, conf.round, conf.zoom));
	}
	return img;
    },
    upload: async ()=> {
	if (!customIcon) return;
	let img = await urlToImg(customIcon);
	img = urlToImg(imgToURLOfSize(img, highestPx, customForm.round.checked, customForm.crop.checked));
	return img;
    },
};

async function getImageForIcon(value, sharedState) {
    return await setup[value.type](value, sharedState);
}

async function makeIconList(element, sharedState, step) {
    lastStep = step;
    if (!sharedState.icon) sharedState.icon = 0;
    for (let i in icons) {
	i = parseInt(i);
	const icon = icons[i];
	const div = document.createElement("div");
	div.addEventListener("click", () => {
	    Array.from(element.children).forEach(e => {
		e.classList.remove("active");
	    });
	    div.classList.add("active");
	    sharedState.icon = i;
	    if (icon.type === "upload") {
		step.customIcon.classList.remove("hidden");
	    } else {
		step.customIcon.classList.add("hidden");
	    }
	    step.updateSelectedIcon(icon);
	});
	const img = await getImageForIcon(icon, sharedState);
	if (img)
	    div.append(img);
	const span = document.createElement("span");
	span.innerText = icon.name;
	if (i == sharedState.icon) div.classList.add("active");
	div.append(span);
	if (icon.type === "upload") customIconDiv = div;
	element.append(div);
    }
    step.updateSelectedIcon(icons[sharedState.icon]);
}

async function updatedCustomIcon() {
    lastStep.updateSelectedIcon(uploadIcon);
    const img = await getImageForIcon(uploadIcon).catch(console.error); // HACK: This one doesn't depend on shared state, for now
    const div = customIconDiv
    div.innerText = null;
    if (img)
	div.append(img);
    const span = document.createElement("span");
    span.innerText = uploadIcon.name;
    div.append(span);
}

customForm.upload.value = "";
customForm.crop.checked = true;
customForm.round.checked = true;

customForm.upload.addEventListener("change", (e) => {
    const file = e.target.files[0];

    if (!file) {
	return;
    }

    customIcon = URL.createObjectURL(file);
    updatedCustomIcon();
});

customForm.crop.addEventListener("change", () => {
    updatedCustomIcon();
});

customForm.round.addEventListener("change", () => {
    updatedCustomIcon();
});

export {
    makeIconList,
    getImageForIcon,
    icons,
    qualities,
};
