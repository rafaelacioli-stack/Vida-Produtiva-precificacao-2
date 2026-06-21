const win1252 = (text: string) => {
  const map: Record<string, number> = { "€":128,"‚":130,"ƒ":131,"„":132,"…":133,"†":134,"‡":135,"ˆ":136,"‰":137,"Š":138,"‹":139,"Œ":140,"Ž":142,"‘":145,"’":146,"“":147,"”":148,"•":149,"–":150,"—":151,"˜":152,"™":153,"š":154,"›":155,"œ":156,"ž":158,"Ÿ":159 };
  return Array.from(text).map(char => {
    const code = map[char] ?? char.charCodeAt(0);
    const byte = code <= 255 ? code : 63;
    return byte === 40 || byte === 41 || byte === 92 ? `\\${String.fromCharCode(byte)}` : String.fromCharCode(byte);
  }).join("");
};

const wrap = (text: string, max = 88) => text.split(/\s+/).reduce<string[]>((lines, word) => {
  const current = lines.at(-1) ?? "";
  if (!current || current.length + word.length + 1 > max) lines.push(word); else lines[lines.length - 1] = `${current} ${word}`;
  return lines;
}, []);

export function createReportPdf(title: string, report: string) {
  const lines = report.split("\n").flatMap(line => line.trim() ? wrap(line) : [""]);
  const content = ["BT","/F1 18 Tf","50 790 Td",`(${win1252(title)}) Tj`,"0 -30 Td","/F1 10 Tf"];
  for (const line of lines.slice(0, 58)) content.push(`(${win1252(line)}) Tj`, "0 -14 Td");
  content.push("ET");
  const stream = content.join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> endobj",
    `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`
  ];
  let pdf = "%PDF-1.4\n", offset = pdf.length; const offsets = [0];
  for (const object of objects) { offsets.push(offset); pdf += `${object}\n`; offset = pdf.length; }
  const xref = offset; pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(value => `${String(value).padStart(10,"0")} 00000 n `).join("\n")}\ntrailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([new Uint8Array(Array.from(pdf).map(char => char.charCodeAt(0)))], { type: "application/pdf" });
}
