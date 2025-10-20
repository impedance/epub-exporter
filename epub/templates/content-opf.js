// AICODE-LINK: ../epub_generator.js#generateContentOPF
export function getContentOpfTemplate() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<package version="2.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
        <dc:identifier id="BookId">{{BOOK_ID}}</dc:identifier>
        <dc:title>{{TITLE}}</dc:title>
        <dc:creator>EPUB Экспортер</dc:creator>
        <dc:language>ru</dc:language>
        <dc:date>{{TIMESTAMP}}</dc:date>
        <meta name="cover" content="cover"/>
    </metadata>
    <manifest>{{MANIFEST}}
    </manifest>
    <spine toc="ncx">
        <itemref idref="chapter1"/>
    </spine>
</package>`;
}
