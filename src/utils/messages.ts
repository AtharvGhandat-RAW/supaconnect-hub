// Absence notification message templates

export function msgCommonEN(cls: string, subject: string, date: string, rollsCsv: string) {
  return [
    "Dear Parent/Student,",
    "The following students were absent for today's lecture.",
    "",
    `Class: ${cls}`,
    `Subject: ${subject}`,
    `Date: ${date}`,
    "",
    `Absent Roll Nos: ${rollsCsv}`,
    "",
    "Please ensure regular attendance.",
    "— AIML Dept, RIT Polytechnic Pune"
  ].join("\n");
}

export function msgCommonMR(cls: string, subject: string, date: string, rollsCsv: string) {
  return [
    "आदरणीय पालक / विद्यार्थी,",
    "खालील विद्यार्थी आजच्या तासाला गैरहजर होते.",
    "",
    `इयत्ता: ${cls}`,
    `विषय: ${subject}`,
    `दिनांक: ${date}`,
    "",
    `गैरहजर रोल क्र.: ${rollsCsv}`,
    "",
    "नियमित उपस्थिती आवश्यक आहे.",
    "— AIML विभाग, RIT Polytechnic पुणे"
  ].join("\n");
}

export function msgPerStudentEN(name: string, subject: string, cls: string, date: string) {
  return [
    `Dear ${name},`,
    `You were absent for ${subject} lecture.`,
    `Class: ${cls}`,
    `Date: ${date}`,
    "",
    "Please maintain regular attendance.",
    "— AIML Dept, RIT Polytechnic Pune"
  ].join("\n");
}

export function msgPerStudentMR(name: string, subject: string, cls: string, date: string) {
  return [
    `प्रिय ${name},`,
    `आपण आज ${date} रोजी ${cls} च्या ${subject} तासाला गैरहजर होता.`,
    "",
    "कृपया नियमित उपस्थिती राखावी.",
    "— AIML विभाग, RIT Polytechnic पुणे"
  ].join("\n");
}
