/**
 * Markdown → Atlassian Document Format (ADF) converter.
 *
 * Supports: headings, bold, italic, code (inline + fenced), lists (bullet + ordered),
 * blockquotes, horizontal rules, tables, and @mentions.
 *
 * No external dependencies.
 */
// ---------------------------------------------------------------------------
// Inline parser
// ---------------------------------------------------------------------------
/**
 * Parse inline markdown into ADF inline nodes.
 *
 * Handles: **bold**, *italic*, _italic_, `code`, [text](url), @accountId:XXX
 */
function parseInline(text) {
    const nodes = [];
    // Regex alternation for inline patterns (order matters — bold before italic)
    const inlineRe = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(_(.+?)_)|(`([^`]+)`)|\[([^\]]+)\]\(([^)]+)\)|(@accountId:([a-zA-Z0-9:_-]+))/g;
    let lastIndex = 0;
    let match;
    while ((match = inlineRe.exec(text)) !== null) {
        // Push any plain text before this match
        if (match.index > lastIndex) {
            nodes.push({ type: "text", text: text.slice(lastIndex, match.index) });
        }
        if (match[1]) {
            // **bold**
            nodes.push({ type: "text", text: match[2], marks: [{ type: "strong" }] });
        }
        else if (match[3]) {
            // *italic*
            nodes.push({ type: "text", text: match[4], marks: [{ type: "em" }] });
        }
        else if (match[5]) {
            // _italic_
            nodes.push({ type: "text", text: match[6], marks: [{ type: "em" }] });
        }
        else if (match[7]) {
            // `code`
            nodes.push({ type: "text", text: match[8], marks: [{ type: "code" }] });
        }
        else if (match[9] && match[10]) {
            // [text](url)
            nodes.push({
                type: "text",
                text: match[9],
                marks: [{ type: "link", attrs: { href: match[10] } }],
            });
        }
        else if (match[11]) {
            // @accountId:XXXXX
            nodes.push({
                type: "mention",
                attrs: { id: match[12], text: `@${match[12]}`, accessLevel: "" },
            });
        }
        lastIndex = match.index + match[0].length;
    }
    // Trailing text
    if (lastIndex < text.length) {
        nodes.push({ type: "text", text: text.slice(lastIndex) });
    }
    // Ensure at least one node (ADF requires non-empty content for paragraphs)
    if (nodes.length === 0) {
        nodes.push({ type: "text", text: "" });
    }
    return nodes;
}
// ---------------------------------------------------------------------------
// Table parser
// ---------------------------------------------------------------------------
function parseTableBlock(lines) {
    const rows = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Skip separator rows like |---|---|
        if (/^\|[\s\-:|]+\|$/.test(line))
            continue;
        const cells = line
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map((c) => c.trim());
        const isHeader = i === 0;
        const rowContent = cells.map((cellText) => {
            const cellNode = {
                type: isHeader ? "tableHeader" : "tableCell",
                attrs: {},
                content: [{ type: "paragraph", content: parseInline(cellText) }],
            };
            return cellNode;
        });
        rows.push({ type: "tableRow", content: rowContent });
    }
    return {
        type: "table",
        attrs: { isNumberColumnEnabled: false, layout: "default" },
        content: rows,
    };
}
// ---------------------------------------------------------------------------
// Block-level parser (line-by-line state machine)
// ---------------------------------------------------------------------------
export function markdownToAdf(markdown) {
    const lines = markdown.split("\n");
    const blocks = [];
    let i = 0;
    /** Flush accumulated paragraph lines into a paragraph block. */
    const flushParagraph = (paraLines) => {
        if (paraLines.length === 0)
            return;
        const text = paraLines.join("\n");
        if (text.trim() === "")
            return;
        blocks.push({ type: "paragraph", content: parseInline(text) });
    };
    let paragraphBuffer = [];
    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trimEnd();
        // --- Fenced code block ---
        const codeMatch = trimmed.match(/^```(\w*)$/);
        if (codeMatch) {
            flushParagraph(paragraphBuffer);
            paragraphBuffer = [];
            const language = codeMatch[1] || undefined;
            const codeLines = [];
            i++;
            while (i < lines.length && !lines[i].trimEnd().startsWith("```")) {
                codeLines.push(lines[i]);
                i++;
            }
            i++; // skip closing ```
            const codeBlock = {
                type: "codeBlock",
                content: [{ type: "text", text: codeLines.join("\n") }],
            };
            if (language)
                codeBlock.attrs = { language };
            blocks.push(codeBlock);
            continue;
        }
        // --- Horizontal rule ---
        if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(trimmed)) {
            flushParagraph(paragraphBuffer);
            paragraphBuffer = [];
            blocks.push({ type: "rule" });
            i++;
            continue;
        }
        // --- Heading ---
        const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            flushParagraph(paragraphBuffer);
            paragraphBuffer = [];
            const level = Math.min(headingMatch[1].length, 6);
            blocks.push({
                type: "heading",
                attrs: { level },
                content: parseInline(headingMatch[2]),
            });
            i++;
            continue;
        }
        // --- Blockquote ---
        if (/^>\s?/.test(trimmed)) {
            flushParagraph(paragraphBuffer);
            paragraphBuffer = [];
            const quoteLines = [];
            while (i < lines.length && /^>\s?/.test(lines[i].trimEnd())) {
                quoteLines.push(lines[i].replace(/^>\s?/, ""));
                i++;
            }
            const innerMarkdown = quoteLines.join("\n");
            const innerDoc = markdownToAdf(innerMarkdown);
            blocks.push({ type: "blockquote", content: innerDoc.content });
            continue;
        }
        // --- Table (requires header row + separator row like |---|---|) ---
        if (/^\|.+\|/.test(trimmed)) {
            const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : "";
            if (/^\|[\s\-:|]+\|$/.test(nextLine)) {
                flushParagraph(paragraphBuffer);
                paragraphBuffer = [];
                const tableLines = [];
                while (i < lines.length && /^\|.+\|/.test(lines[i].trimEnd())) {
                    tableLines.push(lines[i]);
                    i++;
                }
                blocks.push(parseTableBlock(tableLines));
                continue;
            }
        }
        // --- Bullet list (supports - * + and • markers) ---
        if (/^[\s]*[-*+•]\s+/.test(line)) {
            flushParagraph(paragraphBuffer);
            paragraphBuffer = [];
            const items = [];
            while (i < lines.length && /^[\s]*[-*+•]\s+/.test(lines[i])) {
                const itemText = lines[i].replace(/^[\s]*[-*+•]\s+/, "");
                items.push({
                    type: "listItem",
                    content: [{ type: "paragraph", content: parseInline(itemText) }],
                });
                i++;
            }
            blocks.push({ type: "bulletList", content: items });
            continue;
        }
        // --- Ordered list ---
        if (/^[\s]*\d+\.\s+/.test(line)) {
            flushParagraph(paragraphBuffer);
            paragraphBuffer = [];
            const items = [];
            while (i < lines.length && /^[\s]*\d+\.\s+/.test(lines[i])) {
                const itemText = lines[i].replace(/^[\s]*\d+\.\s+/, "");
                items.push({
                    type: "listItem",
                    content: [{ type: "paragraph", content: parseInline(itemText) }],
                });
                i++;
            }
            blocks.push({ type: "orderedList", content: items });
            continue;
        }
        // --- Blank line → flush paragraph ---
        if (trimmed === "") {
            flushParagraph(paragraphBuffer);
            paragraphBuffer = [];
            i++;
            continue;
        }
        // --- Default: accumulate paragraph text ---
        paragraphBuffer.push(trimmed);
        i++;
    }
    // Flush remaining paragraph
    flushParagraph(paragraphBuffer);
    // ADF doc must have at least one block
    if (blocks.length === 0) {
        blocks.push({ type: "paragraph", content: [{ type: "text", text: "" }] });
    }
    return {
        version: 1,
        type: "doc",
        content: blocks,
    };
}
