// AICODE-LINK: ../epub_generator.js#buildEPUBStructure
export function getStylesTemplate() {
    return `/* Стили для PocketBook EPUB */
body {
    font-family: "Times New Roman", Times, serif;
    font-size: 1em;
    line-height: 1.6;
    margin: 1em;
    text-align: justify;
    color: #000;
    background: #fff;
}

h1, h2, h3, h4, h5, h6 {
    font-family: Arial, sans-serif;
    margin: 1.5em 0 0.5em 0;
    page-break-after: avoid;
    color: #333;
}

h1 {
    font-size: 1.8em;
    text-align: center;
    border-bottom: 2px solid #ccc;
    padding-bottom: 0.5em;
}

h2 { font-size: 1.5em; }
h3 { font-size: 1.3em; }

p {
    margin: 0.8em 0;
    text-indent: 1.2em;
    orphans: 2;
    widows: 2;
}

blockquote {
    margin: 1em 2em;
    padding: 0.5em 1em;
    border-left: 3px solid #ccc;
    font-style: italic;
    background: #f9f9f9;
}

img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 1em auto;
    page-break-inside: avoid;
}

pre, code {
    font-family: "Courier New", monospace;
    background: #f5f5f5;
    padding: 0.2em 0.4em;
    border-radius: 3px;
    font-size: 0.9em;
    white-space: pre-wrap;
    word-wrap: break-word;
}

pre {
    padding: 1em;
    margin: 1em 0;
    border: 1px solid #ddd;
    overflow-x: auto;
}

pre code {
    background: none;
    padding: 0;
    border-radius: 0;
    font-size: inherit;
}

/* Syntax highlighting classes */
.hljs-keyword { color: #007020; font-weight: bold; }
.hljs-string { color: #4070a0; }
.hljs-comment { color: #408080; font-style: italic; }
.hljs-number { color: #208050; }
.hljs-title { color: #0000ff; }
.hljs-class { color: #445588; font-weight: bold; }
.hljs-property { color: #333333; }
.hljs-variable { color: #19177c; }

ul, ol {
    margin: 1em 0;
    padding-left: 1.5em;
}

ul {
    list-style-type: disc;
}

ol {
    list-style-type: decimal;
}

li {
    margin: 0.5em 0;
    padding-left: 0.2em;
    line-height: 1.4;
}

li p {
    margin: 0.2em 0;
    text-indent: 0;
}`;
}
