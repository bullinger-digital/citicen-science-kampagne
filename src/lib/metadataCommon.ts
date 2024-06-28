export const directTextContent = (node: Element) => {
  return Array.from(node.childNodes).reduce(function (a, b) {
    return a + (b.nodeType === 3 ? b.textContent : "");
  }, "");
};

export const dateAsString = (dateNode: Element) => {
  const dateText = directTextContent(dateNode);
  if (dateText) {
    return dateText;
  }

  // Otherwise, we either have a when, notBefore, notAfter, or both notBefore and notAfter attribute
  const when = dateNode.getAttribute("when");
  const notBefore = dateNode.getAttribute("notBefore");
  const notAfter = dateNode.getAttribute("notAfter");

  // If we have a when attribute, render it
  if (when) {
    return singleDate(when);
  }

  // If we have a notBefore and notAfter attribute, render both
  if (notBefore && notAfter) {
    return `Zwischen ${singleDate(notBefore)} und ${singleDate(notAfter)}`;
  }

  // If we have a notBefore attribute only, render it
  if (notBefore) {
    return `Nach ${singleDate(notBefore)}`;
  }

  // If we have a notAfter attribute only, render it
  if (notAfter) {
    return `Vor ${singleDate(notAfter)}`;
  }
};

const singleDate = (date: string) => {
  // A date string can contain a date in the format YYYY-MM-DD whereby the month and day are optional
  const dateParts = date.split("-");
  const year = dateParts[0];
  const month = dateParts[1];
  const day = dateParts[2] ? dateParts[2].replace(/^0+/g, "") : null;

  // Derive month name from month number by converting the date to a Date object
  const dateObj = new Date(date);
  const monthName = dateObj.toLocaleString("de", { month: "long" });

  // If we have a year only, return the year
  if (!month) {
    return year;
  }

  // If we have a month and day, return the full date
  if (day) {
    return `${day}. ${monthName} ${year}`;
  }

  // If we have a month only, return the month and year
  return `${monthName} ${year}`;
};
