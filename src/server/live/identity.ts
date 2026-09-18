import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
} from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { LiveError } from "./common";

type Identity = { id: string; publicKey: string; privateKey: string };
const loading = new Map<string, Promise<Identity>>();
export function loadIdentity(
  path = ".data/openclaw-device.json",
): Promise<Identity> {
  const file = resolve(path);
  const previous = loading.get(file);
  if (previous) return previous;
  const pending = readOrCreate(file).finally(() => loading.delete(file));
  loading.set(file, pending);
  return pending;
}
async function readOrCreate(file: string): Promise<Identity> {
  try {
    let privateKey: string;
    try {
      privateKey = JSON.parse(await readFile(file, "utf8")).privateKey;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      privateKey = generateKeyPairSync("ed25519")
        .privateKey.export({ format: "pem", type: "pkcs8" })
        .toString();
      await mkdir(dirname(file), { recursive: true, mode: 0o700 });
      try {
        await writeFile(file, JSON.stringify({ privateKey }), {
          flag: "wx",
          mode: 0o600,
        });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        // Another process owns the file; never overwrite or rotate its identity.
        privateKey = JSON.parse(await readFile(file, "utf8")).privateKey;
      }
    }
    const key = createPrivateKey(privateKey);
    if (key.asymmetricKeyType !== "ed25519") throw new Error("Invalid key");
    const raw = createPublicKey(key)
      .export({ format: "der", type: "spki" })
      .subarray(-32);
    return {
      id: createHash("sha256").update(raw).digest("hex"),
      publicKey: raw.toString("base64url"),
      privateKey,
    };
  } catch {
    throw new LiveError(
      "DEVICE_STORAGE",
      "Não foi possível ler/criar a identidade OpenClaw. Verifique OPENCLAW_DEVICE_FILE e as permissões do volume persistente.",
    );
  }
}
