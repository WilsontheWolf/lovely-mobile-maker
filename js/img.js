function urlToImg(url) {
    if (!url) return Promise.reject("No URL Provided");
    return new Promise((res, rej) => {
	const img = new Image();
	img.addEventListener("load", () => res(img));
	img.addEventListener("error", (e) => {
	    console.error(e.error);
	    rej("Failed to get image")
	});
	img.src = url;
    });
}

function imgToURLOfSize(img, d, round, fit) {
    const canvas = document.createElement("canvas");
    canvas.width = d;
    canvas.height = d;
    const ctx = canvas.getContext("2d");

    const iw = img.width;
    const ih = img.height;
    if (round) {
	ctx.beginPath();
	const r = d / 2;
	ctx.arc(r, r, r, 0, Math.PI * 2, true);
	ctx.closePath();
	ctx.clip();
    }
    if (ih > iw !== fit) { // Portrait
	const ratio = ih / iw;
	const scale = ih / d;
	ctx.drawImage(img, -(iw / scale - d) / 2, 0, d / ratio, d);
    } else { // Landscape
	const ratio = ih / iw;
	const scale = iw / d;
	ctx.drawImage(img, 0, -(ih / scale - d) / 2, d, d * ratio);
    }
    return canvas.toDataURL("image/png")
}

function imgToPNGOfSize(img, d, round, fit) {
    return convertDataURIToBinary(imgToURLOfSize(img, d, round, fit));
}

const BASE64_MARKER = ';base64,';
function convertDataURIToBinary(dataURI) {
    const base64Index = dataURI.indexOf(BASE64_MARKER) + BASE64_MARKER.length;
    const base64 = dataURI.substring(base64Index);
    const raw = window.atob(base64);
    const rawLength = raw.length;
    const array = new Uint8Array(new ArrayBuffer(rawLength));

    for(let i = 0; i < rawLength; i++) {
	array[i] = raw.charCodeAt(i);
    }
    return array;
}

function convertBinaryToDataURI(binary, contentType) {
    return `data:${contentType};base64,${btoa(String.fromCharCode(...binary))}`;
}

export {
    urlToImg,
    imgToPNGOfSize,
    convertBinaryToDataURI,
    imgToURLOfSize,
}

