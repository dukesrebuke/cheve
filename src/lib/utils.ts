export function formatDate(timestamp: any) {
  if (!timestamp?.toDate) return "";
  const date = timestamp.toDate();
  return date.toLocaleString();
}

export function exportToCSV(data: any[]) {
  const headers = ["Input", "Output", "Created"];
  const rows = data.map((item) => [
    `"${item.input}"`,
    `"${item.output}"`,
    `"${item.createdAt?.toDate()?.toLocaleString() || ""}"`
  ]);

  const csvContent =
    "data:text/csv;charset=utf-8," +
    [headers, ...rows].map((e) => e.join(",")).join("\n");

  const link = document.createElement("a");
  link.setAttribute("href", encodeURI(csvContent));
  link.setAttribute("download", "translations.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}