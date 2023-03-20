export async function loadCommonFonts() {
  const webfontloader = await import('webfontloader')

  webfontloader.load({
    google: {
      families: ['Roboto:100,300,400,500,700,900&display=swap'],
    },
    // urls: ['https://cdn.jsdelivr.net/npm/@mdi/font@5.x/css/materialdesignicons.min.css']
  })
}
