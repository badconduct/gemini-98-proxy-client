const { escapeHtml } = require("../lib/utils");

/**
 * Creates a complete HTML page with a consistent structure.
 * @param {{title: string, styles: string, body: string, scripts?: string, metaRefreshTag?: string}} options
 * @returns {string} The full HTML document.
 */
function renderHtmlPage({
  title,
  styles,
  body,
  scripts = "",
  metaRefreshTag = "",
}) {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">
<html>
  <head>
    <title>${escapeHtml(title)}</title>
    ${metaRefreshTag}
    <link rel="shortcut icon" href="/favicon.ico">
    <meta http-equiv="Content-Type" content="text/html; charset=windows-1252">
    <style type="text/css">${styles}</style>
  </head>
  <body>
    ${body}
    ${scripts ? `<script type="text/javascript">${scripts}</script>` : ""}
  </body>
</html>`;
}

module.exports = {
  renderHtmlPage,
};
