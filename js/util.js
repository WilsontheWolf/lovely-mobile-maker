const identityPreprocess = /[^\w\-\~\.\(\)\[\]]/g;
const identityGet = /^[a-z0-9]+/;

function nameToIdentity(name) {
    name = name.replaceAll(identityPreprocess, "").toLowerCase();
    return name.match(identityGet)?.[0];
}

function downloadURL(data, fileName) {
    const a = document.createElement('a')
    a.href = data
    a.download = fileName
    document.body.appendChild(a)
    a.style.display = 'none'
    a.click()
    a.remove()
}

const downloadBlob = (data, fileName, mimeType) => {
    const blob = new Blob([data], {
	type: mimeType
    })

    const url = window.URL.createObjectURL(blob)

    downloadURL(url, fileName)

    setTimeout(() => window.URL.revokeObjectURL(url), 1000)
}

function asyncTimeout(t) {
    return new Promise((res) => {
	setTimeout(() => res(), t);
    });
}

export {
    downloadBlob,
    downloadURL,
    nameToIdentity,
    asyncTimeout,
}
