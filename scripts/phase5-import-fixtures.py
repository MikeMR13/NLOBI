# Deterministic synthetic EPUB/DOCX/PDF fixtures; no user data.
import zipfile, io, pathlib
root=pathlib.Path('/tmp/nlobi-phase5-import')
root.mkdir(exist_ok=True)
def makezip(filename, entries):
  with zipfile.ZipFile(root/filename,'w') as z:
    for name,txt in entries:
      z.writestr(name,txt,compress_type=zipfile.ZIP_STORED if name=='mimetype' else zipfile.ZIP_DEFLATED)
xhtml=lambda content:'<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Capítulos</title></head><body>'+content+'</body></html>'
png=__import__('base64').b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZpTQAAAAASUVORK5CYII=')
makezip('filename-not-chapter.epub', [
 ('mimetype','application/epub+zip'),
 ('META-INF/container.xml','<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'),
 ('OPS/book.opf','<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Libro de prueba</dc:title></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="cover" href="cover.png" media-type="image/png" properties="cover-image"/><item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/><item id="ch2" href="ch2.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="ch1"/><itemref idref="ch2"/></spine></package>'),
 ('OPS/nav.xhtml',xhtml('<nav epub:type="toc" xmlns:epub="http://www.idpf.org/2007/ops"><ol><li><a href="ch1.xhtml">第一章 Prueba</a></li><li><a href="ch2.xhtml">第二章 Final</a></li></ol></nav>')),
 ('OPS/ch1.xhtml',xhtml('<h1>第一章 Prueba</h1><p>Primer capítulo EPUB de prueba.</p><ruby>漢字<rt>かんじ</rt></ruby>')),
 ('OPS/ch2.xhtml',xhtml('<h1>第二章 Final</h1><p>Segundo capítulo EPUB de prueba.</p><img src="cover.png"/>')),
 ('OPS/cover.png',png)
])
makezip('filename-not-chapter.docx',[
 ('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>'),
 ('_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
 ('word/document.xml','<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Capítulo 1</w:t></w:r></w:p><w:p><w:r><w:t>Primer capítulo DOCX de prueba.</w:t></w:r></w:p><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Capítulo 2</w:t></w:r></w:p><w:p><w:r><w:t>Segundo capítulo DOCX de prueba.</w:t></w:r></w:p><w:sectPr/></w:body></w:document>'),
 ('word/styles.xml','<?xml version="1.0"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style></w:styles>'),
 ('word/_rels/document.xml.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>')
])
pdf=['%PDF-1.4\n']
objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
stream='BT /F1 16 Tf 54 770 Td (Capitulo 1) Tj 0 -28 Td /F1 11 Tf (Primer capitulo PDF de prueba.) Tj 0 -42 Td /F1 16 Tf (Capitulo 2) Tj 0 -28 Td /F1 11 Tf (Segundo capitulo PDF de prueba.) Tj ET'
objects.append('<< /Length '+str(len(stream))+' >>\nstream\n'+stream+'\nendstream')
offset=[0]
for i,obj in enumerate(objects):
  offset.append(sum(map(len,pdf)))
  pdf.append(str(i+1)+' 0 obj\n'+obj+'\nendobj\n')
xref=sum(map(len,pdf))
pdf.append('xref\n0 '+str(len(offset))+'\n0000000000 65535 f \n')
for p in offset[1:]:pdf.append(str(p).zfill(10)+' 00000 n \n')
pdf.append('trailer\n<< /Size '+str(len(offset))+' /Root 1 0 R >>\nstartxref\n'+str(xref)+'\n%%EOF')
(root/'filename-not-chapter.pdf').write_bytes(''.join(pdf).encode())
print('TEST_FILES',[(p.name,p.stat().st_size) for p in root.iterdir()])
