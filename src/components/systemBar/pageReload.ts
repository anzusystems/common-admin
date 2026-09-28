// Its own module so a test can replace it: a real browser's `window.location` cannot be redefined.
export const reloadPage = () => window.location.reload()
