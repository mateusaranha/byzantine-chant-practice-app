import type { Highlight, Melisma } from "./hymnState";

/** Offsets always refer to the original Greek string, in UTF-16 (like DOM Range). */
export type TransliterationUnit = { text: string; start: number; end: number };
type Letter = TransliterationUnit & {
  base: string;
  stressed: boolean;
  diaeresis: boolean;
  upper: boolean;
  capitals: boolean;
};

const LETTERS: Record<string, string> = {
  α: "a", β: "v", γ: "g", δ: "dh", ε: "e", ζ: "z", η: "i", θ: "th",
  ι: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p",
  ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o",
};
const VOWEL_PAIRS: Record<string, string> = { αι: "e", ει: "i", οι: "i", ου: "u", υι: "ii" };
const ACCENTS: Record<string, string> = { a: "á", e: "é", i: "í", o: "ó", u: "ú", y: "ý" };

function readLetters(source: string): Letter[] {
  const letters: Letter[] = [];
  let offset = 0;
  for (const character of source) {
    const previous = letters[letters.length - 1];
    if (/\p{M}/u.test(character) && previous) {
      previous.text += character;
      previous.end += character.length;
    } else {
      letters.push({
        text: character, start: offset, end: offset + character.length,
        base: "", stressed: false, diaeresis: false, upper: false, capitals: false,
      });
    }
    offset += character.length;
  }
  for (const letter of letters) {
    // Normalize only the reading copy; never rewrite the saved lyrics or offsets.
    const decomposed = letter.text.normalize("NFD");
    const first = decomposed[0];
    // Common Greek lookalikes produced when copying the parish PDF.
    const base = first === "µ" ? "μ" : first === "∆" ? "δ" : first.toLowerCase();
    if (!(base in LETTERS)) continue;
    letter.base = base;
    letter.stressed = /[\u0300\u0301\u0342]/u.test(decomposed);
    letter.diaeresis = decomposed.includes("\u0308");
    letter.upper = first === "∆" || first !== first.toLowerCase();
  }
  for (let start = 0; start < letters.length;) {
    if (!letters[start].base) { start += 1; continue; }
    let end = start + 1;
    while (letters[end]?.base) end += 1;
    const capitals = end - start > 1 && letters.slice(start, end).every((letter) => letter.upper);
    for (let index = start; index < end; index += 1) letters[index].capitals = capitals;
    start = end;
  }
  return letters;
}

function pairAt(letters: Letter[], index: number) {
  const first = letters[index];
  const second = letters[index + 1];
  // A stressed first vowel or a diaeresis separates the vowels (e.g. αΐ, άι).
  if (!first?.base || !second?.base || first.stressed || second.diaeresis) return "";
  const pair = first.base + second.base;
  return pair in VOWEL_PAIRS || pair === "αυ" || pair === "ευ" ? pair : "";
}

function frontVowelAt(letters: Letter[], index: number) {
  const base = letters[index]?.base;
  const pair = pairAt(letters, index);
  return !!base && ("εηιυ".includes(base) || pair === "αι" || pair === "οι");
}

function stressed(text: string, stress: boolean) {
  // In υι → ii, the accent belongs to the second i.
  return stress ? text.replace(/[aeiouy](?=[^aeiouy]*$)/, (vowel) => ACCENTS[vowel]) : text;
}

function withCase(text: string, first: Letter) {
  if (first.capitals) return text.toUpperCase();
  return first.upper ? text[0].toUpperCase() + text.slice(1) : text;
}

/** Parish reading aid, not a phonetic transcription or a translation. */
export function transliterateGreek(source: string): TransliterationUnit[] {
  const letters = readLetters(source);
  const units: TransliterationUnit[] = [];
  for (let index = 0; index < letters.length; index += 1) {
    const first = letters[index];
    if (!first.base) {
      units.push({ text: first.text, start: first.start, end: first.end });
      continue;
    }
    const second = letters[index + 1];
    const pair = pairAt(letters, index);
    const consonants = first.base + (second?.base || "");
    let text: string;
    let count = 1;
    if (pair) {
      count = 2;
      if (pair === "αυ" || pair === "ευ") {
        const following = letters[index + 2]?.base || "";
        const unvoiced = !!following && "θκξπστφχψς".includes(following);
        text = stressed(pair === "αυ" ? "a" : "e", second.stressed) + (unvoiced ? "f" : "v");
      } else {
        text = stressed(VOWEL_PAIRS[pair], second.stressed);
      }
    } else if (["μπ", "ντ", "γγ", "γκ"].includes(consonants)) {
      count = 2;
      const initial = !letters[index - 1]?.base;
      if (consonants === "μπ") text = initial ? "b" : "mb";
      else if (consonants === "ντ") text = initial ? "d" : "nd";
      else if (consonants === "γκ") text = initial ? "g" : "nk";
      else text = frontVowelAt(letters, index + 2) ? "ngh" : "ng";
    } else {
      text = first.base === "γ" && frontVowelAt(letters, index + 1) ? "gh" : LETTERS[first.base];
      text = stressed(text, first.stressed);
    }
    units.push({ text: withCase(text, first), start: first.start, end: letters[index + count - 1].end });
    index += count - 1;
  }
  return units;
}

export function projectTransliteration(
  units: TransliterationUnit[], highlights: Highlight[], melismas: Melisma[],
) {
  const segments: { text: string; color?: string; melisma?: Melisma["kind"] }[] = [];
  for (const unit of units) {
    // An indivisible conversion (e.g. αι → e) inherits any overlapping mark.
    // If competing marks cover its letters, keep the first mark's precedence,
    // matching the Greek renderer. This never changes the original ranges.
    const overlaps = (mark: { start: number; end: number }) =>
      mark.end > mark.start && mark.start < unit.end && mark.end > unit.start;
    const color = highlights.find(overlaps)?.color;
    const melisma = melismas.find(overlaps)?.kind;
    const previous = segments[segments.length - 1];
    if (previous && previous.color === color && previous.melisma === melisma) previous.text += unit.text;
    else segments.push({ text: unit.text, color, melisma });
  }
  return segments;
}
