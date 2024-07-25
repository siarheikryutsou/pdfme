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
const paddintTopInput = document.getElementById("padding-top") as HTMLInputElement;
const paddintBotInput = document.getElementById("padding-bottom") as HTMLInputElement;
const paddintLeftInput = document.getElementById("padding-left") as HTMLInputElement;
const paddintRightInput = document.getElementById("padding-right") as HTMLInputElement;

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
                        const schemas = templateJSON.schemas[0];
                        const inputs: { [key: string]: string } = {};
                        for (const [key, value] of Object.entries(schemas)) {
                            const el = value as { type: string, content: string };
                            switch (el.type) {
                                case "text":
                                    inputs[key] = el.content;
                                    break;
                            }
                        }

                        const pdf = await generate({
                            template: templateJSON,
                            inputs: [inputs],
                            plugins,
                            options: {font}
                        });
                        const blob = new Blob([pdf.buffer], {type: 'application/pdf'});
                        const url = URL.createObjectURL(blob);
                        window.open(url, '_blank');
                    } catch
                        (error) {
                        console.error("PFD generation error:", error);
                    }
                }
            );
        }

        if (paddintTopInput && paddintBotInput && paddintLeftInput && paddintRightInput) {
            const paddings = (template.basePdf as { padding: [number, number, number, number] }).padding;
            const inputs = [paddintTopInput, paddintRightInput, paddintBotInput, paddintLeftInput];
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