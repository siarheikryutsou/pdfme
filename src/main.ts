import {Designer} from '@pdfme/ui';
import type {Template} from '@pdfme/common';
import {BLANK_PDF, Font} from "@pdfme/common";
import {text, readOnlyText, image, line, readOnlySvg, rectangle, tableBeta} from "@pdfme/schemas";
import {generate} from '@pdfme/generator';

declare global {
    interface Window {
        showSaveFilePicker?: (options?: FilePickerOptions) => Promise<FileSystemFileHandle>;
    }
}

interface FilePickerOptions {
    types?: Array<{
        description: string;
        accept: { [key: string]: string[] };
    }>;
    excludeAcceptAllOption?: boolean;
    suggestedName?: string;
}

const domContainer = document.getElementById("designer") as HTMLInputElement;
const uploadInput = document.getElementById("upload") as HTMLInputElement;
const downloadButton = document.getElementById("download") as HTMLButtonElement;
const saveButton = document.getElementById("save") as HTMLButtonElement;
const autosaveInput = document.getElementById("autosave") as HTMLInputElement;
const generateButton = document.getElementById("generate") as HTMLButtonElement;
const paddingTopInput = document.getElementById("padding-top") as HTMLInputElement;
const paddingBotInput = document.getElementById("padding-bottom") as HTMLInputElement;
const paddingLeftInput = document.getElementById("padding-left") as HTMLInputElement;
const paddingRightInput = document.getElementById("padding-right") as HTMLInputElement;

const plugins = {
    text,
    readOnlyText,
    image,
    readOnlySvg,
    line,
    rectangle,
    tableBeta
}
const savedTemplate = window.localStorage.getItem("template");
const template: Template = savedTemplate ? JSON.parse(savedTemplate) : {
    basePdf: BLANK_PDF,
    schemas: []
}

async function loadFonts(): Promise<Font> {
    const fontUrls = {
        HelveticaNowText: '/fonts/HelveticaNowText-Regular.ttf',
        HelveticaNowTextBold: '/fonts/HelveticaNowText-Bold.ttf'
    };

    const fontPromises = Object.entries(fontUrls).map(async ([fontName, url]) => {
        const response = await fetch(url);
        const data = await response.arrayBuffer();
        return [fontName, {data}];
    });

    const fontEntries = await Promise.all(fontPromises);
    const fonts: Font = Object.fromEntries(fontEntries);
    fonts.HelveticaNowText.fallback = true;

    return fonts;
}

loadFonts().then(font => {

    if (domContainer) {
        const designer = new Designer({domContainer, template, plugins, options: {font}});

        function saveTemplate(): void {
            window.localStorage.setItem("template", getTemplateJSONString());
        }

        function getTemplateJSONString(): string {
            return JSON.stringify(designer.getTemplate(), null, 2);
        }

        function getTemplateJSON() {
            return JSON.parse(getTemplateJSONString());
        }

        function setFooterPositions(fromY: number, footerElements: { position: { y: number } }[]) {
            footerElements[0].position.y = fromY;
            footerElements[1].position.y = fromY + 16;
            footerElements[2].position.y = fromY + 14;
            footerElements[3].position.y = fromY + 25;
        }

        function setHeaderPositions(fromY: number, headerElements: { position: { y: number } }[]) {
            headerElements[0].position.y = fromY;
            headerElements[1].position.y = fromY + 10;
            headerElements[2].position.y = fromY + 12.4;
            headerElements[3].position.y = fromY + 5;
            headerElements[4].position.y = fromY + 33;
            headerElements[5].position.y = fromY + 35;
            headerElements[6].position.y = fromY + 41;
            headerElements[7].position.y = fromY + 55;
            headerElements[8].position.y = fromY + 59;
            headerElements[9].position.y = fromY + 59;
            headerElements[10].position.y = fromY + 67;
        }

        function copyOBJ(obj: object) {
            return JSON.parse(JSON.stringify(obj));
        }

        if (uploadInput) {
            uploadInput.addEventListener("change", (event: Event) => {
                const target = event.target as HTMLInputElement;
                if (target.files) {
                    const file = target.files[0];
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        if (e.target && e.target.result) {
                            try {
                                const json = JSON.parse(e.target.result as string);
                                designer.updateTemplate(json as Template);
                            } catch (error) {
                                console.error("JSON Parsing Error:", error);
                            }
                        }
                    }

                    reader.onerror = (e) => {
                        console.error("File reading error:", e);
                    }

                    reader.readAsText(file);
                }
            });
        }

        if (downloadButton) {
            downloadButton.addEventListener("click", async () => {
                try {
                    const json = getTemplateJSONString();
                    if (window.showSaveFilePicker) {
                        const options = {
                            suggestedName: "template",
                            types: [{
                                description: 'JSON Files',
                                accept: {'application/json': ['.json']}
                            }]
                        };
                        const handle = await window.showSaveFilePicker(options);
                        const writableStream = await handle.createWritable();
                        await writableStream.write(json);
                        await writableStream.close();
                    } else {
                        const blob = new Blob([json], {type: "application/json"});
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "template.json";
                        a.click();
                        URL.revokeObjectURL(url);
                    }
                } catch (error) {
                    console.error('File save error:', error);
                }
            });
        }

        if (saveButton) {
            saveButton.addEventListener("click", () => {
                saveTemplate();
            });
        }

        if (autosaveInput) {
            autosaveInput.checked = !!window.localStorage.getItem("autosave");
            autosaveInput.addEventListener("change", () => {
                if (autosaveInput.checked) {
                    window.localStorage.setItem("autosave", "true");
                } else {
                    window.localStorage.removeItem("autosave");
                }
            });
        }

        if (generateButton) {
            generateButton.addEventListener("click", async () => {
                    try {
                        const templateJSON = JSON.parse(getTemplateJSONString());
                        const schema = templateJSON.schemas[0];
                        const inputs: { [key: string]: string } = {};
                        const row = ["24 May, 2024\n202401:13:37 PM", "Payment link", "1.09 USD\n1.11 USDT", "-", "1.59 USD"];
                        const tableData = new Array(35).fill(row).map((el, i) => {
                            const copy = copyOBJ(el);
                            copy[3] = i.toString();
                            return copy;
                        });

                        const PAGE_1_TABLE_ROWS_MAX = 4;
                        const PAGE_2_TABLE_ROWS_MAX = 7;
                        const headerElements = [
                            schema.header_rect,
                            schema.logo,
                            schema.header_rect_hr,
                            schema.lunu_address,
                            schema.header_title,
                            schema.period_title,
                            schema.period,
                            schema.table_header_rect,
                            schema.table_header_title,
                            schema.table_period,
                            schema.table
                        ];
                        const footerElements = [
                            schema.footer_el_1,
                            schema.footer_el_2,
                            schema.footer_el_3,
                            schema.pages
                        ];


                        if (tableData.length > PAGE_1_TABLE_ROWS_MAX) {
                            inputs.table = JSON.stringify(tableData.splice(0, PAGE_1_TABLE_ROWS_MAX));
                            setFooterPositions(277 - (21 * (PAGE_1_TABLE_ROWS_MAX - 1)), footerElements);

                            const pagesLength = Math.ceil(tableData.length / PAGE_2_TABLE_ROWS_MAX);

                            for(let pageI = 1; pageI < pagesLength + 1; pageI++) {
                                const nextTableData = tableData.splice(0, PAGE_2_TABLE_ROWS_MAX);
                                const pageN = pageI + 1;
                                templateJSON.schemas[pageI] = {};
                                const nextHeaderElements = headerElements.map((el, i) => {
                                    const copy = copyOBJ(el);
                                    templateJSON.schemas[pageI][`page_${pageN}_header_el_${(i + 1)}`] = copy;
                                    return copy;
                                });

                                const nextFooterElements = footerElements.map((el, i) => {
                                    const copy = copyOBJ(el);
                                    templateJSON.schemas[pageI][`page_${pageN}_footer_el_${(i + 1)}`] = copy;
                                    return copy;
                                });

                                new Array(115-28).fill({}).map((_, i) => {
                                    const hr = copyOBJ(schema['field' + (28 + i)]);
                                    hr.position.y = 90;
                                    templateJSON.schemas[pageI][`page_${pageN}_table_hr_${(i + 1)}`] = hr;
                                    return hr;
                                });

                                inputs[`page_${pageN}_header_el_${nextHeaderElements.length}`] = JSON.stringify(nextTableData);
                                inputs[`page_${pageN}_header_el_7`] = schema.period.content;
                                inputs[`page_${pageN}_header_el_10`] = schema.table_period.content;
                                inputs[`page_${pageN}_footer_el_${nextFooterElements.length}`] = `Page ${pageN} of ${pagesLength + 1}`;
                                setHeaderPositions(10, nextHeaderElements);
                                setFooterPositions(
                                    215,
                                    nextFooterElements
                                );
                            }
                            schema.pages.content = inputs.pages = `Page 1 of ${pagesLength + 1}`;
                        } else {
                            inputs.table = JSON.stringify(tableData);
                            setFooterPositions(277 - (21 * (tableData.length - 1)), footerElements);
                            inputs.pages = "Page 1 of 1";
                        }

                        for (const [key, value] of Object.entries(schema)) {
                            const el = value as { type: string, content: string };
                            switch (el.type) {
                                case "text":
                                    inputs[key] = el.content;
                                    break;
                            }
                        }

                        console.log(templateJSON)

                        const pdf = await generate({
                            template: templateJSON,
                            inputs: [inputs],
                            plugins,
                            options: {font}
                        });
                        const blob = new Blob([pdf.buffer], {type: "application/pdf"});
                        const url = URL.createObjectURL(blob);
                        window.open(url, "_blank");
                    } catch
                        (error) {
                        console.error("PFD generation error:", error);
                    }
                }
            );
        }

        if (paddingTopInput && paddingBotInput && paddingLeftInput && paddingRightInput) {
            const paddings = (template.basePdf as { padding: [number, number, number, number] }).padding;
            const inputs = [paddingTopInput, paddingRightInput, paddingBotInput, paddingLeftInput];
            if (paddings) {
                inputs.forEach((input, i) => {
                    input.value = paddings[i].toString();
                })
            } else {
                inputs.forEach(input => input.value = "0");
            }

            inputs.forEach((input, i) => {
                input.min = "0";
                input.addEventListener("change", (event: Event) => {
                    const value = (event.target as HTMLInputElement).value;
                    const template = getTemplateJSON();
                    template.basePdf.padding[i] = parseFloat(value);
                    designer.updateTemplate(template);
                });
            });
        }

        designer.onChangeTemplate(() => {
            if (autosaveInput.checked) {
                saveTemplate();
            }
        });

    }
});