// AICODE-LINK: ../epub_generator.js#generateChapterXHTML
export function getChapterXhtmlTemplate() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <title>{{TITLE}}</title>
    <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
    <h1>{{TITLE}}</h1>
    {{CONTENT}}
</body>
</html>`;
}
