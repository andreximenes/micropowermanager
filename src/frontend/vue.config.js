const ImportMetaEnvPlugin = require("@import-meta-env/unplugin")

module.exports = {
  // Served under /legacy next to the new app (src/web), which owns the site root.
  publicPath: "/legacy/",
  lintOnSave: false,
  devServer: {
    allowedHosts: "all",
  },
  css: {
    loaderOptions: {
      scss: {
        prependData: `@use "@/assets/sass/brand" as *;`,
      },
    },
  },
  configureWebpack: {
    performance: {
      hints: false,
    },
    plugins: [
      ImportMetaEnvPlugin.webpack({
        example: ".env.example",
        env: ".env",
      }),
    ],
  },
}
