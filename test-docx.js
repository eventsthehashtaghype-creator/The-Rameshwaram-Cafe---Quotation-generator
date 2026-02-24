const docx = require("docx");
const fs = require("fs");

const { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType } = docx;

const doc = new Document({
    sections: [{
        children: [
            new Table({
                width: { size: "100%", type: WidthType.PERCENTAGE },
                rows: [
                    new TableRow({
                        children: [
                            new TableCell({
                                width: { size: "60%", type: WidthType.PERCENTAGE },
                                children: [new Paragraph("This is cell 1, which should be 60% of the page width and have enough space to not wrap heavily.")]
                            }),
                            new TableCell({
                                width: { size: "40%", type: WidthType.PERCENTAGE },
                                children: [new Paragraph("This is cell 2, 40%.")]
                            })
                        ]
                    })
                ]
            }),
            new Paragraph(""),
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                columnWidths: [5400, 3600],
                rows: [
                    new TableRow({
                        children: [
                            new TableCell({
                                children: [new Paragraph("This is cell 1, DXA 5400 columnWidth without explicit TableCell width.")]
                            }),
                            new TableCell({
                                children: [new Paragraph("This is cell 2, DXA 3600 columnWidth without explicit TableCell width.")]
                            })
                        ]
                    })
                ]
            })
        ]
    }]
});

Packer.toBuffer(doc).then((buffer) => {
    fs.writeFileSync("test.docx", buffer);
    console.log("test.docx written");
}).catch(console.error);
