function urlToImg(url) {
    return new Promise((res, rej) => {
	const img = new Image();
	img.src = url;
	img.addEventListener("load", () => res(img));
	img.addEventListener("error", () => rej("Failed to get image"));
    });
}

function imgToPNGOfSize(img, d) {
    const canvas = document.createElement("canvas");
    canvas.width = d;
    canvas.height = d;
    const ctx = canvas.getContext("2d");

    const iw = img.width;
    const ih = img.height;
    if (ih > iw) { // Portrait
	const ratio = ih / iw;
	const scale = ih / d;
	ctx.drawImage(img, -(iw / scale - d) / 2, 0, d / ratio, d);
    } else { // Landscape
	const ratio = ih / iw;
	const scale = iw / d;
	ctx.drawImage(img, 0, -(ih / scale - d) / 2, d, d * ratio);
    }
    const url = canvas.toDataURL("image/png")
    return convertDataURIToBinary(url);
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

export {
    urlToImg,
    imgToPNGOfSize,
}
    
