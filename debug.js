const debugMessage = (m) => {
    if (typeof window.ReactNativeWebView != 'undefined') {
        window.ReactNativeWebView.postMessage(
            JSON.stringify({
                type: 'epubjs',
                message: m,
            }),
        )
    } else {
        console.log(m)
    }
}

export default debugMessage