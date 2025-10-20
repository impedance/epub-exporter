// AICODE-LINK: ../epub_generator.js#generateChapterXHTML
export function getChapterXhtmlTemplate() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
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
