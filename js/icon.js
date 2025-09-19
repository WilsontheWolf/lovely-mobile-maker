import { zip_open, zip_read_file, entry_names, write_file, zip_save_and_sign_v2 } from "./pkg/mbf_bindgen.js";
import { urlToImg, convertBinaryToDataURI, imgToURLOfSize } from "./img.js";
import sharedState from "./state.js";
import { getMainDir } from "./util.js";

const uploadIcon = {
    type: "upload",
    name: "Custom",
};

const internalIcon = {
    type: "internal",
    name: "Default",
}

let icons;
const androidIcons = [
    internalIcon,
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

const iOSIcons = [
    internalIcon,
    {
	type: "external",
	name: "Balatro",
	src: "/img/Balatro.png",
    },
    {
	type: "external",
	name: "LÖVE",
	src: "/img/love-ios.png",
    },
    uploadIcon,
];

let customIcon = null;
let customIconDiv = null;
let lastStep;

const qualitiesIOS = {
    highest: "iOS AppIcon60x60@3x.png",
    all: [
	["iOS AppIcon29x29@2x.png", 58],
	["iOS AppIcon29x29@2x~ipad.png", 58],
	["iOS AppIcon29x29@3x.png", 87],
	["iOS AppIcon40x40@2x.png", 80],
	["iOS AppIcon40x40@3x.png", 120],
	["iOS AppIcon60x60@2x.png", 120],
	["iOS AppIcon60x60@3x.png", 180],
	["iOS AppIcon29x29~ipad.png", 29],
	["iOS AppIcon29x29@2x.png", 58],
	["iOS AppIcon40x40~ipad.png", 40],
	["iOS AppIcon40x40@2x.png", 80],
	["iOS AppIcon40x40@2x~ipad.png", 80],
	["iOS AppIcon76x76~ipad.png", 76],
	["iOS AppIcon76x76@2x~ipad.png", 152],
	["iOS AppIcon83.5x83.5@2x~ipad.png", 167],
    ],
    getPath: (q) => `${getMainDir(sharedState.apk, "ios")}${q}`,
}

const qualitiesAndroid = {
    highest: "xxxhdpi",
    all: [
	["mdpi", 48],
	["hdpi", 72],
	["xhdpi", 96],
	["xxhdpi", 144],
	["xxxhdpi", 192],
    ],
    getPath: (q) => `res/drawable-${q}-v4/love.png`,
};

const customForm = {
    upload: document.getElementById("icon-upload"),
    crop: document.getElementById("icon-crop"),
    round: document.getElementById("icon-round"),
};

qualitiesAndroid.highestPx = qualitiesAndroid.all.find(i => i[0] === qualitiesAndroid.highest)[1];
qualitiesIOS.highestPx = qualitiesIOS.all.find(i => i[0] === qualitiesIOS.highest)[1];

function getQualities() {
    if (sharedState.platform === "ios") return qualitiesIOS;
    return qualitiesAndroid;
}

const setup = {
    internal: () => {
	const qualities = getQualities();
	const path = qualities.getPath(qualities.highest);
	const iconBuffer = zip_read_file(sharedState.apk, path);
	return urlToImg(convertBinaryToDataURI(iconBuffer, "image/png"));
    },
    external: async (conf) => {
	let img = await urlToImg(conf.src);
	if (conf.round || conf.zoom) {
	    img = urlToImg(imgToURLOfSize(img, getQualities().highestPx, conf.round, conf.zoom));
	}
	return img;
    },
    upload: async () => {
	if (!customIcon) return;
	let img = await urlToImg(customIcon);
	img = urlToImg(imgToURLOfSize(img, getQualities().highestPx, sharedState.platform === "ios" ? false : customForm.round.checked, customForm.crop.checked));
	return img;
    },
};

async function getImageForIcon(value) {
    return await setup[value.type](value);
}

async function makeIconList(element,  step) {
    lastStep = step;
    if (!sharedState.icon) sharedState.icon = 0;
    icons = sharedState.platform === "ios" ? iOSIcons : androidIcons;
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
    getQualities,
};
