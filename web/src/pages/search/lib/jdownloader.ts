const JDOWNLOADER_ADD_URL = 'http://127.0.0.1:9666/flash/add'

export async function sendToJDownloader(url: string, packageName: string) {
  const body = new URLSearchParams({
    urls: url,
    source: window.location.href,
    package: packageName,
  })

  // no-cors allows the browser to send the simple form request without requiring
  // JDownloader's legacy local endpoint to expose CORS headers.
  await fetch(JDOWNLOADER_ADD_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
}
