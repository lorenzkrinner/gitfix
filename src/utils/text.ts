export function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function capitalizeWords(str: string): string {
  const splitted = str.split(/[-_\s,]+/);
  return splitted.map((word) => capitalize(word)).join(" ");
}

export function removeWhitespace(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
