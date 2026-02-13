/**
 * Markdown → Atlassian Document Format (ADF) converter.
 *
 * Supports: headings, bold, italic, code (inline + fenced), lists (bullet + ordered),
 * blockquotes, horizontal rules, tables, and @mentions.
 *
 * No external dependencies.
 */
export interface AdfDocument {
    version: 1;
    type: "doc";
    content: AdfBlock[];
}
export type AdfBlock = AdfHeading | AdfParagraph | AdfBulletList | AdfOrderedList | AdfCodeBlock | AdfBlockquote | AdfRule | AdfTable;
export interface AdfHeading {
    type: "heading";
    attrs: {
        level: number;
    };
    content: AdfInline[];
}
export interface AdfParagraph {
    type: "paragraph";
    content: AdfInline[];
}
export interface AdfBulletList {
    type: "bulletList";
    content: AdfListItem[];
}
export interface AdfOrderedList {
    type: "orderedList";
    content: AdfListItem[];
}
export interface AdfListItem {
    type: "listItem";
    content: AdfBlock[];
}
export interface AdfCodeBlock {
    type: "codeBlock";
    attrs?: {
        language?: string;
    };
    content: AdfInline[];
}
export interface AdfBlockquote {
    type: "blockquote";
    content: AdfBlock[];
}
export interface AdfRule {
    type: "rule";
}
export interface AdfTable {
    type: "table";
    attrs: {
        isNumberColumnEnabled: false;
        layout: "default";
    };
    content: AdfTableRow[];
}
export interface AdfTableRow {
    type: "tableRow";
    content: (AdfTableHeader | AdfTableCell)[];
}
export interface AdfTableHeader {
    type: "tableHeader";
    attrs: {};
    content: AdfBlock[];
}
export interface AdfTableCell {
    type: "tableCell";
    attrs: {};
    content: AdfBlock[];
}
export type AdfInline = AdfText | AdfMention | AdfHardBreak;
export interface AdfText {
    type: "text";
    text: string;
    marks?: AdfMark[];
}
export interface AdfMention {
    type: "mention";
    attrs: {
        id: string;
        text: string;
        accessLevel: string;
    };
}
export interface AdfHardBreak {
    type: "hardBreak";
}
export type AdfMark = {
    type: "strong";
} | {
    type: "em";
} | {
    type: "code";
} | {
    type: "link";
    attrs: {
        href: string;
    };
};
export declare function markdownToAdf(markdown: string): AdfDocument;
