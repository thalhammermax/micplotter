export interface LegacyMplPage {
  act: number;
  scene: number;
  pageLabel: string;
  isInterval: boolean;
  comment: string;
}

export interface LegacyMplCharacter {
  name: string;
  abbreviation: string;
  playedByIndex: number | null;
}

export interface LegacyMplCastMember {
  name: string;
  abbreviation: string;
}

export interface LegacyMplProject {
  sourceVersion: string;
  showName: string;
  productionDate: string;
  productionCompany: string;
  micplotVersion: string;
  notes: string;
  pages: LegacyMplPage[];
  characters: LegacyMplCharacter[];
  cast: LegacyMplCastMember[];
  parserWarnings: string[];
}

class Reader {
  constructor(
    private readonly bytes: Uint8Array,
    public position = 0,
  ) {}

  get remaining() {
    return this.bytes.length - this.position;
  }

  byte() {
    if (this.position >= this.bytes.length) {
      throw new Error("Unexpected end of MicPlot file.");
    }
    return this.bytes[this.position++];
  }

  bool() {
    const value = this.byte();
    if (value === 0x54) return true; // T
    if (value === 0x46) return false; // F
    throw new Error("Invalid MicPlot boolean value.");
  }

  shortString() {
    const length = this.byte();
    if (this.remaining < length) {
      throw new Error("Invalid MicPlot string length.");
    }
    const slice = this.bytes.slice(this.position, this.position + length);
    this.position += length;
    return new TextDecoder("windows-1252").decode(slice);
  }

  skip(length: number) {
    if (length < 0 || this.remaining < length) {
      throw new Error("Unexpected end of MicPlot file.");
    }
    this.position += length;
  }
}

function roundToEven(value: number) {
  const floor = Math.floor(value);
  const fraction = value - floor;
  if (fraction < 0.5) return floor;
  if (fraction > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}

/**
 * MicPlot 2.x/3.x enables its byte encryption after writing the plaintext
 * version header. The Delphi reader resets RandSeed to zero, calls Random,
 * multiplies by 255, rounds, and XORs that byte with each stored byte.
 */
export function decryptLegacyPayload(payload: Uint8Array) {
  const result = new Uint8Array(payload.length);
  let seed = 0;

  for (let index = 0; index < payload.length; index += 1) {
    seed = (Math.imul(seed, 0x08088405) + 1) >>> 0;
    const key = roundToEven((seed / 0x1_0000_0000) * 255) & 0xff;
    result[index] = payload[index] ^ key;
  }

  return result;
}

function parseVersionCode(version: string) {
  const normalized = version.toLowerCase();

  // The current executable internally maps legacy formats to small reader
  // version codes. 2.1 files use the code-5 layout. 3.0 files use the newer
  // code-7 layout; that layout will be expanded as additional fixtures arrive.
  if (normalized.startsWith("2.1")) return 5;
  if (normalized.startsWith("2.0")) return 4;
  if (normalized.startsWith("1.3")) return 3;
  if (normalized.startsWith("1.2")) return 2;
  if (normalized.startsWith("1.1")) return 1;
  if (normalized.startsWith("1.0") || normalized === "10") return 0;
  if (normalized.startsWith("3.0")) return 7;

  throw new Error(
    "This MicPlot file version is not supported yet: " + version,
  );
}

function parseHeader(bytes: Uint8Array) {
  if (!bytes.length) throw new Error("The MicPlot file is empty.");

  const length = bytes[0];
  if (length < 10 || bytes.length < length + 1) {
    throw new Error("Unrecognised MicPlot file header.");
  }

  const header = new TextDecoder("windows-1252").decode(
    bytes.slice(1, 1 + length),
  );

  const match = header.match(
    /^Micplot by (?:CH Sound Design|Chris Hubbard)\. Version ([^\0]+)$/i,
  );

  if (!match) {
    throw new Error("Unrecognised MicPlot file format.");
  }

  return {
    header,
    version: match[1].trim(),
    payloadOffset: 1 + length,
  };
}

function parseShow(reader: Reader) {
  const showName = reader.shortString();
  const productionDate = reader.shortString();
  const productionCompany = reader.shortString();
  const micplotVersion = reader.shortString();
  const notes = reader.shortString();

  const pageCount = reader.byte();
  const pages: LegacyMplPage[] = [];

  for (let index = 0; index < pageCount; index += 1) {
    const isInterval = reader.bool();
    const act = reader.byte();
    const scene = reader.byte();
    const pageLabel = reader.shortString();

    // A legacy page flag exists in the binary record but is not surfaced in
    // MicPlot's 3.0i user-facing Show fields. Preserve parsing alignment.
    reader.bool();

    const comment = reader.shortString();

    pages.push({
      act,
      scene,
      pageLabel,
      isInterval,
      comment,
    });
  }

  return {
    showName,
    productionDate,
    productionCompany,
    micplotVersion,
    notes,
    pages,
  };
}

function parseCharacters(reader: Reader, versionCode: number) {
  const count = reader.byte();
  const characters: LegacyMplCharacter[] = [];

  for (let index = 0; index < count; index += 1) {
    const name = reader.shortString();
    const abbreviation = versionCode > 0 ? reader.shortString() : "";

    const playedBy = reader.byte();

    if (versionCode === 0) {
      reader.byte();
      reader.shortString();
    } else if (versionCode < 7) {
      reader.byte();
    } else {
      // MicPlot 3.0 adds character mic-priority/quality fields.
      reader.byte();
      reader.byte();
    }

    if (versionCode < 4) {
      reader.shortString();
    }

    characters.push({
      name,
      abbreviation,
      playedByIndex: playedBy > 0 ? playedBy - 1 : null,
    });
  }

  return characters;
}

function parseCast(reader: Reader, versionCode: number) {
  const count = reader.byte();
  const cast: LegacyMplCastMember[] = [];

  for (let index = 0; index < count; index += 1) {
    const name = reader.shortString();
    const abbreviation = reader.shortString();

    reader.bool(); // ensemble

    if (versionCode >= 7) {
      reader.byte(); // ensemble priority
    }

    // The original cast record contains When Miked plus equipment matching
    // preferences. We consume all fields here even though the first importer
    // only maps identity data. Later parser revisions will map every preference.
    reader.byte();
    reader.byte();
    reader.byte();
    reader.byte();
    reader.byte();
    reader.byte();
    reader.byte();

    reader.shortString(); // legacy 32-byte set serialized as a short string
    reader.byte();
    reader.byte();
    reader.shortString();

    cast.push({ name, abbreviation });
  }

  return cast;
}

export function parseLegacyMpl(input: ArrayBuffer | Uint8Array): LegacyMplProject {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const { version, payloadOffset } = parseHeader(bytes);
  const versionCode = parseVersionCode(version);

  const decrypted = decryptLegacyPayload(bytes.slice(payloadOffset));
  const reader = new Reader(decrypted);

  // First 8 encrypted bytes are MicPlot's file data stamp.
  reader.skip(8);

  const show = parseShow(reader);
  const characters = parseCharacters(reader, versionCode);
  const cast = parseCast(reader, versionCode);

  const warnings: string[] = [];
  if (versionCode >= 7) {
    warnings.push(
      "MicPlot 3.0 character/cast compatibility is preliminary until a 3.0 .mpl fixture is validated.",
    );
  }

  warnings.push(
    "Understudies, detailed movement stage states, transmitter groups, and allocation history are not imported in the first compatibility pass yet.",
  );

  return {
    sourceVersion: version,
    ...show,
    characters,
    cast,
    parserWarnings: warnings,
  };
}
